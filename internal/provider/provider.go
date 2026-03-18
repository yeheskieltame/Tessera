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

type Chain struct {
	backends []backend
	client   *http.Client
}

func New() *Chain {
	c := &Chain{
		client: &http.Client{Timeout: 120 * time.Second},
	}
	c.buildChain()
	return c
}

func (c *Chain) buildChain() {
	// Claude CLI first — works with Claude Code / Max plan subscription, no API key needed
	if claudeCLIAvailable() {
		model := envOr("CLAUDE_CLI_MODEL", "sonnet")
		c.backends = append(c.backends, backend{Name: "claude-cli", Model: model, Call: callClaudeCLI})
	}
	if key := os.Getenv("ANTHROPIC_API_KEY"); key != "" {
		model := envOr("CLAUDE_MODEL", "claude-sonnet-4-6")
		c.backends = append(c.backends, backend{Name: "claude-api", Model: model, Call: c.callClaude})
	}
	if key := os.Getenv("GEMINI_API_KEY"); key != "" {
		model := envOr("GEMINI_MODEL", "gemini-2.0-flash")
		c.backends = append(c.backends, backend{Name: "gemini", Model: model, Call: c.callGemini})
	}
	if key := os.Getenv("OPENAI_API_KEY"); key != "" {
		model := envOr("OPENAI_MODEL", "gpt-4o")
		c.backends = append(c.backends, backend{Name: "openai", Model: model, Call: c.callOpenAI})
	}
	if url := os.Getenv("ANTIGRAVITY_URL"); url != "" {
		model := envOr("ANTIGRAVITY_MODEL", "claude-sonnet-4-5-thinking")
		c.backends = append(c.backends, backend{Name: "antigravity", Model: model, Call: c.callAntigravity})
	}
}

func (c *Chain) Providers() []struct{ Name, Model string } {
	out := make([]struct{ Name, Model string }, len(c.backends))
	for i, b := range c.backends {
		out[i] = struct{ Name, Model string }{b.Name, b.Model}
	}
	return out
}

func (c *Chain) HasProviders() bool {
	return len(c.backends) > 0
}

func (c *Chain) Complete(ctx context.Context, prompt, system string) (*Response, error) {
	if len(c.backends) == 0 {
		return nil, fmt.Errorf("no AI providers configured — set at least one API key")
	}

	var errs []string
	for _, b := range c.backends {
		text, err := b.Call(ctx, prompt, system, b.Model)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", b.Name, err))
			continue
		}
		return &Response{Text: text, Model: b.Model, Provider: b.Name}, nil
	}
	return nil, fmt.Errorf("all AI providers failed:\n%s", joinLines(errs))
}

// --- Claude ---

func (c *Chain) callClaude(ctx context.Context, prompt, system, model string) (string, error) {
	body := map[string]any{
		"model":      model,
		"max_tokens": 8192,
		"system":     orDefault(system, "You are a public goods data analyst."),
		"messages":   []map[string]string{{"role": "user", "content": prompt}},
	}
	resp, err := c.post(ctx, "https://api.anthropic.com/v1/messages", body, map[string]string{
		"x-api-key":         os.Getenv("ANTHROPIC_API_KEY"),
		"anthropic-version":  "2023-06-01",
		"content-type":       "application/json",
	})
	if err != nil {
		return "", err
	}
	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", err
	}
	if len(result.Content) == 0 {
		return "", fmt.Errorf("empty response from Claude")
	}
	return result.Content[0].Text, nil
}

// --- Claude CLI (Max plan via `claude --print`) ---

func claudeCLIAvailable() bool {
	// Check if claude binary exists and is not disabled
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

// --- Antigravity ---

func (c *Chain) callAntigravity(ctx context.Context, prompt, system, model string) (string, error) {
	baseURL := os.Getenv("ANTIGRAVITY_URL")
	body := map[string]any{
		"model":      model,
		"max_tokens": 8192,
		"system":     orDefault(system, "You are a public goods data analyst."),
		"messages":   []map[string]string{{"role": "user", "content": prompt}},
	}
	resp, err := c.post(ctx, baseURL+"/v1/messages", body, map[string]string{
		"content-type": "application/json",
	})
	if err != nil {
		return "", err
	}
	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", err
	}
	if len(result.Content) == 0 {
		return "", fmt.Errorf("empty response from Antigravity")
	}
	return result.Content[0].Text, nil
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

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
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
