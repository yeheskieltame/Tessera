package data

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// DiscourseClient queries a Discourse forum for community signal collection.
type DiscourseClient struct {
	baseURL string
	client  *http.Client
}

// NewOctantDiscourseClient creates a client for discuss.octant.app.
func NewOctantDiscourseClient() *DiscourseClient {
	return &DiscourseClient{
		baseURL: "https://discuss.octant.app",
		client:  &http.Client{Timeout: 15 * time.Second},
	}
}

// NewDiscourseClient creates a client for any Discourse instance.
func NewDiscourseClient(baseURL string) *DiscourseClient {
	return &DiscourseClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *DiscourseClient) get(ctx context.Context, path string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
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
		return nil, fmt.Errorf("Discourse HTTP %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}
	return body, nil
}

// --- Search ---

// DiscoursePost holds a post from search results.
type DiscoursePost struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"created_at"`
	LikeCount int    `json:"like_count"`
	Blurb     string `json:"blurb"`
	TopicID   int    `json:"topic_id"`
}

// DiscourseTopic holds a topic from search results.
type DiscourseTopic struct {
	ID           int    `json:"id"`
	Title        string `json:"title"`
	Slug         string `json:"slug"`
	PostsCount   int    `json:"posts_count"`
	ReplyCount   int    `json:"reply_count"`
	CreatedAt    string `json:"created_at"`
	LastPostedAt string `json:"last_posted_at"`
	CategoryID   int    `json:"category_id"`
}

// DiscourseSearchResult holds the full search response.
type DiscourseSearchResult struct {
	Posts  []DiscoursePost  `json:"posts"`
	Topics []DiscourseTopic `json:"topics"`
}

// Search queries the Discourse search API.
func (c *DiscourseClient) Search(ctx context.Context, query string) (*DiscourseSearchResult, error) {
	data, err := c.get(ctx, "/search.json?q="+url.QueryEscape(query))
	if err != nil {
		return nil, err
	}
	var result DiscourseSearchResult
	return &result, json.Unmarshal(data, &result)
}

// --- Topic Detail ---

// DiscourseTopicDetail holds detailed info about a single topic.
type DiscourseTopicDetail struct {
	ID           int    `json:"id"`
	Title        string `json:"title"`
	PostsCount   int    `json:"posts_count"`
	ReplyCount   int    `json:"reply_count"`
	CreatedAt    string `json:"created_at"`
	LastPostedAt string `json:"last_posted_at"`
	LikeCount    int    `json:"like_count"`
	PostStream   struct {
		Posts []struct {
			ID        int    `json:"id"`
			Username  string `json:"username"`
			CreatedAt string `json:"created_at"`
			Cooked    string `json:"cooked"` // HTML content
			LikeCount int    `json:"like_count"`
			ReplyCount int   `json:"reply_count"`
		} `json:"posts"`
	} `json:"post_stream"`
}

// GetTopic fetches a single topic with its posts.
func (c *DiscourseClient) GetTopic(ctx context.Context, topicID int) (*DiscourseTopicDetail, error) {
	data, err := c.get(ctx, fmt.Sprintf("/t/%d.json", topicID))
	if err != nil {
		return nil, err
	}
	var result DiscourseTopicDetail
	return &result, json.Unmarshal(data, &result)
}

// --- Community Signals ---

// CommunitySignals aggregates community engagement metrics for a project.
type CommunitySignals struct {
	Source          string   `json:"source"`          // e.g. "discuss.octant.app"
	ProjectQuery    string   `json:"projectQuery"`
	TopicsFound     int      `json:"topicsFound"`
	TotalPosts      int      `json:"totalPosts"`
	TotalReplies    int      `json:"totalReplies"`
	TotalLikes      int      `json:"totalLikes"`
	UniqueAuthors   int      `json:"uniqueAuthors"`
	AvgLikesPerPost float64  `json:"avgLikesPerPost"`
	MostRecentPost  string   `json:"mostRecentPost"`  // ISO date
	OldestPost      string   `json:"oldestPost"`      // ISO date
	TopTopics       []string `json:"topTopics"`       // titles of most engaged topics
	PostExcerpts    []string `json:"postExcerpts"`    // blurbs for AI analysis
	TeamResponded   bool     `json:"teamResponded"`   // did multiple users post (proxy for team engagement)
}

// CollectCommunitySignals searches a Discourse forum and aggregates engagement.
func (c *DiscourseClient) CollectCommunitySignals(ctx context.Context, projectName string) *CommunitySignals {
	signals := &CommunitySignals{
		Source:       c.baseURL,
		ProjectQuery: projectName,
	}

	result, err := c.Search(ctx, projectName)
	if err != nil || (len(result.Posts) == 0 && len(result.Topics) == 0) {
		return signals
	}

	signals.TopicsFound = len(result.Topics)
	signals.TotalPosts = len(result.Posts)

	// Aggregate metrics from search results
	authors := map[string]bool{}
	for _, p := range result.Posts {
		signals.TotalLikes += p.LikeCount
		authors[p.Username] = true

		if len(signals.PostExcerpts) < 10 && p.Blurb != "" {
			signals.PostExcerpts = append(signals.PostExcerpts, p.Blurb)
		}

		// Track date range
		if signals.MostRecentPost == "" || p.CreatedAt > signals.MostRecentPost {
			signals.MostRecentPost = p.CreatedAt
		}
		if signals.OldestPost == "" || p.CreatedAt < signals.OldestPost {
			signals.OldestPost = p.CreatedAt
		}
	}
	signals.UniqueAuthors = len(authors)
	signals.TeamResponded = len(authors) >= 2 // at least 2 different people posting

	if signals.TotalPosts > 0 {
		signals.AvgLikesPerPost = float64(signals.TotalLikes) / float64(signals.TotalPosts)
	}

	// Aggregate from topics
	for _, t := range result.Topics {
		signals.TotalReplies += t.ReplyCount
		if len(signals.TopTopics) < 5 {
			signals.TopTopics = append(signals.TopTopics, t.Title)
		}
	}

	// Fetch detail for top topic to get more engagement data
	if len(result.Topics) > 0 {
		detail, err := c.GetTopic(ctx, result.Topics[0].ID)
		if err == nil && detail != nil {
			signals.TotalLikes += detail.LikeCount
			for _, p := range detail.PostStream.Posts {
				authors[p.Username] = true
			}
			signals.UniqueAuthors = len(authors)
		}
	}

	return signals
}

// FormatCommunitySignals returns markdown for LLM context or display.
func (s *CommunitySignals) FormatCommunitySignals() string {
	if s.TopicsFound == 0 && s.TotalPosts == 0 {
		return fmt.Sprintf("No community discussions found for \"%s\" on %s.", s.ProjectQuery, s.Source)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("### Community Signals (%s)\n", s.Source))
	b.WriteString(fmt.Sprintf("- Query: \"%s\"\n", s.ProjectQuery))
	b.WriteString(fmt.Sprintf("- Topics found: %d | Posts: %d | Replies: %d\n", s.TopicsFound, s.TotalPosts, s.TotalReplies))
	b.WriteString(fmt.Sprintf("- Total likes: %d | Avg likes/post: %.1f\n", s.TotalLikes, s.AvgLikesPerPost))
	b.WriteString(fmt.Sprintf("- Unique authors: %d | Team responded: %v\n", s.UniqueAuthors, s.TeamResponded))

	if s.MostRecentPost != "" {
		b.WriteString(fmt.Sprintf("- Date range: %s to %s\n", s.OldestPost[:10], s.MostRecentPost[:10]))
	}

	if len(s.TopTopics) > 0 {
		b.WriteString("- Top threads:\n")
		for _, t := range s.TopTopics {
			b.WriteString(fmt.Sprintf("  - %s\n", t))
		}
	}
	b.WriteString("\n")

	return b.String()
}
