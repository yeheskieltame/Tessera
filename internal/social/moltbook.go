package social

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const MoltbookBaseURL = "https://www.moltbook.com/api/v1"

type MoltbookClient struct {
	apiKey  string
	client  *http.Client
	baseURL string
}

func NewMoltbookClient() *MoltbookClient {
	return &MoltbookClient{
		apiKey:  os.Getenv("MOLTBOOK_API_KEY"),
		client:  &http.Client{Timeout: 30 * time.Second},
		baseURL: MoltbookBaseURL,
	}
}

func (c *MoltbookClient) Available() bool {
	return c.apiKey != ""
}

// --- HTTP helpers ---

func (c *MoltbookClient) get(ctx context.Context, path string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body[:min(300, len(body))]))
	}
	return body, nil
}

func (c *MoltbookClient) post(ctx context.Context, path string, payload interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+path, bytes.NewReader(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body[:min(300, len(body))]))
	}
	return body, nil
}

// --- Response types ---

type HomeResponse struct {
	Karma               int `json:"karma"`
	UnreadNotifications int `json:"unread_notifications"`
	UnreadDMs           int `json:"unread_dms"`
}

type Notification struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Message   string `json:"message"`
	Read      bool   `json:"read"`
	CreatedAt string `json:"created_at"`
}

type Post struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	Submolt   string `json:"submolt_name"`
	URL       string `json:"url"`
	CreatedAt string `json:"created_at"`
}

type Comment struct {
	ID        string `json:"id"`
	Content   string `json:"content"`
	Author    string `json:"author"`
	ParentID  string `json:"parent_id,omitempty"`
	CreatedAt string `json:"created_at"`
}

type SearchResult struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Submolt string `json:"submolt_name"`
	URL     string `json:"url"`
}

type AgentStatus struct {
	Username string `json:"username"`
	Karma    int    `json:"karma"`
	Verified bool   `json:"verified"`
}

// --- API methods ---

// GetHome returns the agent's home dashboard (karma, unread counts).
func (c *MoltbookClient) GetHome(ctx context.Context) (*HomeResponse, error) {
	data, err := c.get(ctx, "/home")
	if err != nil {
		return nil, err
	}
	var result HomeResponse
	return &result, json.Unmarshal(data, &result)
}

// GetNotifications returns the agent's notifications (replies, follows, mentions).
func (c *MoltbookClient) GetNotifications(ctx context.Context) ([]Notification, error) {
	data, err := c.get(ctx, "/notifications")
	if err != nil {
		return nil, err
	}
	var result []Notification
	return result, json.Unmarshal(data, &result)
}

// CreatePost publishes a new post to a submolt.
func (c *MoltbookClient) CreatePost(ctx context.Context, submolt, title, content string) (*Post, error) {
	payload := map[string]string{
		"submolt_name": submolt,
		"title":        title,
		"content":      content,
	}
	data, err := c.post(ctx, "/posts", payload)
	if err != nil {
		return nil, err
	}
	var result Post
	return &result, json.Unmarshal(data, &result)
}

// GetPostComments returns all comments on a post.
func (c *MoltbookClient) GetPostComments(ctx context.Context, postID string) ([]Comment, error) {
	data, err := c.get(ctx, fmt.Sprintf("/posts/%s/comments", postID))
	if err != nil {
		return nil, err
	}
	var result []Comment
	return result, json.Unmarshal(data, &result)
}

// ReplyToComment adds a reply to an existing comment on a post.
func (c *MoltbookClient) ReplyToComment(ctx context.Context, postID, parentID, content string) error {
	payload := map[string]string{
		"content":   content,
		"parent_id": parentID,
	}
	_, err := c.post(ctx, fmt.Sprintf("/posts/%s/comments", postID), payload)
	return err
}

// ReplyToPost adds a top-level comment on a post.
func (c *MoltbookClient) ReplyToPost(ctx context.Context, postID, content string) error {
	payload := map[string]string{
		"content": content,
	}
	_, err := c.post(ctx, fmt.Sprintf("/posts/%s/comments", postID), payload)
	return err
}

// FollowAgent follows another agent by username.
func (c *MoltbookClient) FollowAgent(ctx context.Context, username string) error {
	_, err := c.post(ctx, fmt.Sprintf("/agents/%s/follow", username), map[string]string{})
	return err
}

// VerifyPost submits a verification answer (anti-spam math challenge).
func (c *MoltbookClient) VerifyPost(ctx context.Context, verificationCode, answer string) error {
	payload := map[string]string{
		"verification_code": verificationCode,
		"answer":            answer,
	}
	_, err := c.post(ctx, "/verify", payload)
	return err
}

// SearchPosts searches for posts matching a query.
func (c *MoltbookClient) SearchPosts(ctx context.Context, query string, limit int) ([]SearchResult, error) {
	path := fmt.Sprintf("/search?q=%s&type=posts&limit=%d", query, limit)
	data, err := c.get(ctx, path)
	if err != nil {
		return nil, err
	}
	var result []SearchResult
	return result, json.Unmarshal(data, &result)
}

// GetAgentStatus returns the authenticated agent's status.
func (c *MoltbookClient) GetAgentStatus(ctx context.Context) (*AgentStatus, error) {
	data, err := c.get(ctx, "/agents/status")
	if err != nil {
		return nil, err
	}
	var result AgentStatus
	return &result, json.Unmarshal(data, &result)
}

// --- Math challenge solver ---

var numberPattern = regexp.MustCompile(`\d+`)

// SolveMathChallenge attempts to extract and solve a simple math problem from challenge text.
// Moltbook anti-spam challenges are typically "what's the product of X and Y" style.
func SolveMathChallenge(challengeText string) string {
	lower := strings.ToLower(challengeText)
	nums := numberPattern.FindAllString(challengeText, -1)
	if len(nums) < 2 {
		return ""
	}

	a, err1 := strconv.ParseFloat(nums[0], 64)
	b, err2 := strconv.ParseFloat(nums[1], 64)
	if err1 != nil || err2 != nil {
		return ""
	}

	var result float64
	switch {
	case strings.Contains(lower, "product"), strings.Contains(lower, "multipl"), strings.Contains(lower, "times"):
		result = a * b
	case strings.Contains(lower, "sum"), strings.Contains(lower, "add"), strings.Contains(lower, "plus"):
		result = a + b
	case strings.Contains(lower, "difference"), strings.Contains(lower, "subtract"), strings.Contains(lower, "minus"):
		result = a - b
	default:
		// Default to multiplication as most common challenge type
		result = a * b
	}

	return fmt.Sprintf("%.2f", result)
}
