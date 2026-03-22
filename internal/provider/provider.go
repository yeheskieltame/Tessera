package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

// --- Model catalog: all supported provider+model combinations ---

type modelEntry struct {
	Provider string
	Model    string
}

// providerOrder defines display/fallback ordering of providers.
var providerOrder = []string{"claude-local", "claude-cli", "claude-api", "gemini", "openai"}

// modelCatalog lists all supported models per provider.
var modelCatalog = map[string][]string{
	"claude-local": {"claude-opus-4-6", "claude-sonnet-4-6"},
	"claude-cli":   {"claude-opus-4-6", "claude-sonnet-4-6"},
	"claude-api":   {"claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"},
	"gemini":       {"gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-3-flash-preview", "gemini-3.1-pro-preview"},
	"openai":       {"gpt-4o", "gpt-4o-mini", "o3-mini"},
}

// providerReadyCheck maps provider name to the env var / check needed.
var providerReasons = map[string]string{
	"claude-local": "Run npx tessera-bridge locally, then click Connect Local Claude",
	"claude-cli":   "claude binary not found — install Claude Code (npm i -g @anthropic-ai/claude-code)",
	"claude-api":   "Set ANTHROPIC_API_KEY in .env",
	"gemini":       "Set GEMINI_API_KEY in .env",
	"openai":       "Set OPENAI_API_KEY in .env",
}

// --- Bridge (remote Claude CLI via tessera-bridge) ---

var globalBridgeURL string

// SetBridgeURL sets the URL of a remote tessera-bridge instance.
func SetBridgeURL(url string) {
	globalBridgeURL = url
}

// GetBridgeURL returns the current bridge URL.
func GetBridgeURL() string {
	return globalBridgeURL
}

// ClearBridge disconnects the bridge.
func ClearBridge() {
	globalBridgeURL = ""
}

// --- Types ---

type Response struct {
	Text     string `json:"text"`
	Model    string `json:"model"`
	Provider string `json:"provider"`
}

type backend struct {
	Name  string
	Model string
	Call  func(ctx context.Context, prompt, system, model string) (string, error)
}

// ProviderInfo describes a supported provider+model combo and its availability.
type ProviderInfo struct {
	Name    string `json:"name"`
	Model   string `json:"model"`
	Ready   bool   `json:"ready"`
	Reason  string `json:"reason,omitempty"`
	Default bool   `json:"default,omitempty"` // first model for this provider
}

type Chain struct {
	backends []backend
	client   *http.Client
	ready    map[string]bool // which providers are ready (have credentials)
}

// --- Global preferred state ---

var (
	globalPreferredProvider string
	globalPreferredModel    string
)

// SetPreferred sets the user-preferred provider+model combination.
func SetPreferred(providerName, model string) {
	globalPreferredProvider = providerName
	globalPreferredModel = model
}

// GetPreferred returns the current preferred provider and model.
func GetPreferred() (string, string) {
	return globalPreferredProvider, globalPreferredModel
}

// --- Chain construction ---

func New() *Chain {
	c := &Chain{
		client: &http.Client{Timeout: 120 * time.Second},
		ready:  map[string]bool{},
	}
	c.buildChain()
	return c
}

func (c *Chain) buildChain() {
	// Claude Local Bridge — user's local Claude CLI via tessera-bridge
	if globalBridgeURL != "" {
		c.ready["claude-local"] = true
		for _, model := range modelCatalog["claude-local"] {
			m := model
			c.backends = append(c.backends, backend{Name: "claude-local", Model: m, Call: c.callBridge})
		}
	}

	// Claude CLI — works with Claude Code / Max plan, no API key needed
	if claudeCLIAvailable() {
		c.ready["claude-cli"] = true
		for _, model := range modelCatalog["claude-cli"] {
			m := model
			c.backends = append(c.backends, backend{Name: "claude-cli", Model: m, Call: callClaudeCLI})
		}
	}

	// Claude API
	if os.Getenv("ANTHROPIC_API_KEY") != "" {
		c.ready["claude-api"] = true
		for _, model := range modelCatalog["claude-api"] {
			m := model
			c.backends = append(c.backends, backend{Name: "claude-api", Model: m, Call: c.callClaude})
		}
	}

	// Gemini
	if os.Getenv("GEMINI_API_KEY") != "" {
		c.ready["gemini"] = true
		for _, model := range modelCatalog["gemini"] {
			m := model
			c.backends = append(c.backends, backend{Name: "gemini", Model: m, Call: c.callGemini})
		}
	}

	// OpenAI
	if os.Getenv("OPENAI_API_KEY") != "" {
		c.ready["openai"] = true
		for _, model := range modelCatalog["openai"] {
			m := model
			c.backends = append(c.backends, backend{Name: "openai", Model: m, Call: c.callOpenAI})
		}
	}
}

// --- Public methods ---

// Providers returns the list of ready providers (unique, for status display).
func (c *Chain) Providers() []struct{ Name, Model string } {
	// Return one entry per ready provider (first/default model)
	var out []struct{ Name, Model string }
	seen := map[string]bool{}
	for _, b := range c.backends {
		if !seen[b.Name] {
			seen[b.Name] = true
			out = append(out, struct{ Name, Model string }{b.Name, b.Model})
		}
	}
	return out
}

func (c *Chain) HasProviders() bool {
	return len(c.backends) > 0
}

// AllProviders returns ALL supported provider+model combos (ready and not ready).
func (c *Chain) AllProviders() []ProviderInfo {
	var all []ProviderInfo

	for _, prov := range providerOrder {
		ready := c.ready[prov]
		reason := ""
		if !ready {
			reason = providerReasons[prov]
			if prov == "claude-cli" && os.Getenv("CLAUDE_CLI_DISABLED") == "true" {
				reason = "Disabled via CLAUDE_CLI_DISABLED"
			}
		}

		models := modelCatalog[prov]
		for i, model := range models {
			all = append(all, ProviderInfo{
				Name:    prov,
				Model:   model,
				Ready:   ready,
				Reason:  reason,
				Default: i == 0,
			})
		}
	}

	return all
}

// Complete sends a prompt to AI providers.
// If a preferred provider+model is set and available, ONLY uses that provider (no silent fallback).
// If no preference is set, falls back through all available providers in order.
func (c *Chain) Complete(ctx context.Context, prompt, system string) (*Response, error) {
	if len(c.backends) == 0 {
		return nil, fmt.Errorf("no AI providers configured — set at least one API key")
	}

	prefProvider, prefModel := GetPreferred()

	// If user explicitly selected a provider, use ONLY that provider (no fallback)
	if prefProvider != "" && prefModel != "" {
		for _, b := range c.backends {
			if b.Name == prefProvider && b.Model == prefModel {
				text, err := b.Call(ctx, prompt, system, b.Model)
				if err != nil {
					return nil, fmt.Errorf("%s/%s failed: %v", b.Name, b.Model, err)
				}
				return &Response{Text: text, Model: b.Model, Provider: b.Name}, nil
			}
		}
		// Preferred provider not found in backends, fall through to auto-select
	}

	// No preference set (or preferred not found): try all providers in order
	var errs []string
	usedProviders := map[string]bool{}
	for _, b := range c.backends {
		if usedProviders[b.Name] {
			continue
		}
		usedProviders[b.Name] = true
		text, err := b.Call(ctx, prompt, system, b.Model)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s/%s: %v", b.Name, b.Model, err))
			continue
		}
		return &Response{Text: text, Model: b.Model, Provider: b.Name}, nil
	}
	return nil, fmt.Errorf("all AI providers failed:\n%s", joinLines(errs))
}

// CompleteChat sends a prompt using the fastest available model (flash/haiku/mini).
// Skips heavy models (opus, pro) to avoid timeouts in interactive chat.
func (c *Chain) CompleteChat(ctx context.Context, prompt, system string) (*Response, error) {
	if len(c.backends) == 0 {
		return nil, fmt.Errorf("no AI providers configured")
	}

	// Prefer fast models for chat
	fastModels := map[string]bool{
		"gemini-2.5-flash": true, "gemini-2.5-flash-lite": true, "gemini-3-flash-preview": true,
		"claude-sonnet-4-6": true, "claude-haiku-4-5": true,
		"gpt-4o-mini": true, "o3-mini": true,
	}

	var fast, fallback []backend
	for _, b := range c.backends {
		if fastModels[b.Model] {
			fast = append(fast, b)
		} else {
			fallback = append(fallback, b)
		}
	}

	// Try fast models first, then heavy as last resort
	ordered := append(fast, fallback...)

	var errs []string
	for _, b := range ordered {
		text, err := b.Call(ctx, prompt, system, b.Model)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s/%s: %v", b.Name, b.Model, err))
			continue
		}
		return &Response{Text: text, Model: b.Model, Provider: b.Name}, nil
	}
	return nil, fmt.Errorf("all AI providers failed:\n%s", joinLines(errs))
}

// --- Claude API ---

// parseClaudeResponse extracts text from Claude API response,
// handling both standard and thinking model formats.
// Thinking models return [{type:"thinking",...}, {type:"text", text:"..."}].
// Standard models return [{type:"text", text:"..."}].
func parseClaudeResponse(data []byte) (string, error) {
	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return "", err
	}
	if len(result.Content) == 0 {
		return "", fmt.Errorf("empty response")
	}
	// Prefer the "text" type block (skip "thinking" blocks)
	for _, block := range result.Content {
		if block.Type == "text" && block.Text != "" {
			return block.Text, nil
		}
	}
	// Fallback: return first non-empty text
	for _, block := range result.Content {
		if block.Text != "" {
			return block.Text, nil
		}
	}
	return "", fmt.Errorf("no text content in response")
}

func (c *Chain) callClaude(ctx context.Context, prompt, system, model string) (string, error) {
	body := map[string]any{
		"model":      model,
		"max_tokens": 8192,
		"system":     orDefault(system, "You are a public goods data analyst."),
		"messages":   []map[string]string{{"role": "user", "content": prompt}},
	}
	resp, err := c.post(ctx, "https://api.anthropic.com/v1/messages", body, map[string]string{
		"x-api-key":        os.Getenv("ANTHROPIC_API_KEY"),
		"anthropic-version": "2023-06-01",
		"content-type":      "application/json",
	})
	if err != nil {
		return "", err
	}
	return parseClaudeResponse(resp)
}

// --- Claude CLI (Max plan via `claude --print`) ---

func claudeCLIAvailable() bool {
	if os.Getenv("CLAUDE_CLI_DISABLED") == "true" {
		return false
	}
	_, err := exec.LookPath("claude")
	return err == nil
}

func callClaudeCLI(ctx context.Context, prompt, system, model string) (string, error) {
	args := []string{
		"--print",
		"--model", model,
		"--output-format", "text",
	}
	if system != "" {
		args = append(args, "--append-system-prompt", system)
	}

	cmd := exec.CommandContext(ctx, "claude", args...)
	cmd.Stdin = strings.NewReader(prompt)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		errMsg := stderr.String()
		if errMsg == "" {
			errMsg = err.Error()
		}
		return "", fmt.Errorf("claude-cli: %s", errMsg)
	}

	text := strings.TrimSpace(stdout.String())
	if text == "" {
		return "", fmt.Errorf("empty response from claude-cli")
	}
	return text, nil
}

// --- Claude Local Bridge (tessera-bridge) ---

func (c *Chain) callBridge(ctx context.Context, prompt, system, model string) (string, error) {
	bridgeURL := GetBridgeURL()
	if bridgeURL == "" {
		return "", fmt.Errorf("bridge not connected")
	}

	reqBody := map[string]string{
		"prompt": prompt,
		"system": system,
		"model":  model,
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, "POST", bridgeURL+"/api/prompt", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("bridge request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("bridge connection failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("bridge read: %w", err)
	}

	if resp.StatusCode != 200 {
		var errResp struct{ Error string `json:"error"` }
		json.Unmarshal(respBody, &errResp)
		if errResp.Error != "" {
			return "", fmt.Errorf("bridge: %s", errResp.Error)
		}
		return "", fmt.Errorf("bridge error: status %d", resp.StatusCode)
	}

	var result struct{ Text string `json:"text"` }
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("bridge parse: %w", err)
	}
	text := strings.TrimSpace(result.Text)
	if text == "" {
		return "", fmt.Errorf("empty response from bridge")
	}
	return text, nil
}

// --- Gemini ---

func (c *Chain) callGemini(ctx context.Context, prompt, system, model string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)

	body := map[string]any{
		"contents": []map[string]any{
			{"parts": []map[string]string{{"text": prompt}}},
		},
	}
	if system != "" {
		body["systemInstruction"] = map[string]any{
			"parts": []map[string]string{{"text": system}},
		}
	}

	resp, err := c.post(ctx, url, body, map[string]string{"Content-Type": "application/json"})
	if err != nil {
		return "", err
	}
	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", err
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from Gemini")
	}
	return result.Candidates[0].Content.Parts[0].Text, nil
}

// --- OpenAI ---

func (c *Chain) callOpenAI(ctx context.Context, prompt, system, model string) (string, error) {
	messages := []map[string]string{}
	if system != "" {
		messages = append(messages, map[string]string{"role": "system", "content": system})
	}
	messages = append(messages, map[string]string{"role": "user", "content": prompt})

	body := map[string]any{
		"model":      model,
		"messages":   messages,
		"max_tokens": 8192,
	}
	resp, err := c.post(ctx, "https://api.openai.com/v1/chat/completions", body, map[string]string{
		"Authorization": "Bearer " + os.Getenv("OPENAI_API_KEY"),
		"Content-Type":  "application/json",
	})
	if err != nil {
		return "", err
	}
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", err
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("empty response from OpenAI")
	}
	return result.Choices[0].Message.Content, nil
}

// --- helpers ---

func (c *Chain) post(ctx context.Context, url string, body any, headers map[string]string) ([]byte, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody[:min(500, len(respBody))]))
	}
	return respBody, nil
}

func orDefault(s, d string) string {
	if s != "" {
		return s
	}
	return d
}

func joinLines(ss []string) string {
	out := ""
	for _, s := range ss {
		out += "  " + s + "\n"
	}
	return out
}
