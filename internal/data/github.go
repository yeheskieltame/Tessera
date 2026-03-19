package data

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// GitHubClient fetches code metrics directly from the GitHub API.
// Used as a fallback when OSO is unavailable.
type GitHubClient struct {
	client *http.Client
}

func NewGitHubClient() *GitHubClient {
	return &GitHubClient{
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

// GitHubRepoMetrics holds key metrics from a GitHub repository.
type GitHubRepoMetrics struct {
	FullName       string `json:"full_name"`
	Stars          int    `json:"stargazers_count"`
	Forks          int    `json:"forks_count"`
	OpenIssues     int    `json:"open_issues_count"`
	Watchers       int    `json:"watchers_count"`
	Language       string `json:"language"`
	DefaultBranch  string `json:"default_branch"`
	UpdatedAt      string `json:"updated_at"`
	PushedAt       string `json:"pushed_at"`
	Archived       bool   `json:"archived"`
	Description    string `json:"description"`
	Size           int    `json:"size"`
}

// GitHubContributor holds contributor info.
type GitHubContributor struct {
	Login         string `json:"login"`
	Contributions int    `json:"contributions"`
}

// GetRepoMetrics fetches repository metrics from GitHub API.
// owner/repo format, e.g. "golemfoundation/octant"
func (c *GitHubClient) GetRepoMetrics(ctx context.Context, owner, repo string) (*GitHubRepoMetrics, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s", owner, repo)
	body, err := c.get(ctx, url)
	if err != nil {
		return nil, err
	}
	var result GitHubRepoMetrics
	return &result, json.Unmarshal(body, &result)
}

// GetContributors fetches top contributors for a repository.
func (c *GitHubClient) GetContributors(ctx context.Context, owner, repo string) ([]GitHubContributor, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contributors?per_page=30", owner, repo)
	body, err := c.get(ctx, url)
	if err != nil {
		return nil, err
	}
	var result []GitHubContributor
	return result, json.Unmarshal(body, &result)
}

// GitHubSignals aggregates all GitHub data for a repo.
type GitHubSignals struct {
	Repo         *GitHubRepoMetrics
	Contributors []GitHubContributor
}

// CollectGitHubSignals fetches repo + contributor data.
func (c *GitHubClient) CollectGitHubSignals(ctx context.Context, owner, repo string) *GitHubSignals {
	signals := &GitHubSignals{}
	signals.Repo, _ = c.GetRepoMetrics(ctx, owner, repo)
	signals.Contributors, _ = c.GetContributors(ctx, owner, repo)
	return signals
}

// FormatSignals returns a human-readable summary for LLM context.
func (s *GitHubSignals) FormatSignals() string {
	if s.Repo == nil {
		return ""
	}
	r := s.Repo
	out := fmt.Sprintf("### GitHub Activity (%s)\n", r.FullName)
	out += fmt.Sprintf("- Stars: %d | Forks: %d | Open Issues: %d | Watchers: %d\n", r.Stars, r.Forks, r.OpenIssues, r.Watchers)
	out += fmt.Sprintf("- Language: %s | Size: %d KB\n", r.Language, r.Size)
	out += fmt.Sprintf("- Last push: %s | Archived: %v\n", r.PushedAt, r.Archived)
	if r.Description != "" {
		out += fmt.Sprintf("- Description: %s\n", r.Description)
	}
	if len(s.Contributors) > 0 {
		out += fmt.Sprintf("- Contributors: %d (top 30)\n", len(s.Contributors))
		totalCommits := 0
		for _, c := range s.Contributors {
			totalCommits += c.Contributions
		}
		out += fmt.Sprintf("- Total commits (top contributors): %d\n", totalCommits)
		if len(s.Contributors) >= 3 {
			out += fmt.Sprintf("- Top 3: %s (%d), %s (%d), %s (%d)\n",
				s.Contributors[0].Login, s.Contributors[0].Contributions,
				s.Contributors[1].Login, s.Contributors[1].Contributions,
				s.Contributors[2].Login, s.Contributors[2].Contributions)
		}
	}
	return out
}

func (c *GitHubClient) get(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "Tessera-Agent")

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
		return nil, fmt.Errorf("GitHub API %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}
	return body, nil
}
