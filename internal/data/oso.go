package data

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const OSOGraphQLURL = "https://www.opensource.observer/api/v1/graphql"

type OSOClient struct {
	url    string
	apiKey string
	client *http.Client
}

func NewOSOClient() *OSOClient {
	return &OSOClient{
		url:    OSOGraphQLURL,
		apiKey: os.Getenv("OSO_API_KEY"),
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

func (c *OSOClient) query(ctx context.Context, q string, vars map[string]any) (json.RawMessage, error) {
	body, _ := json.Marshal(graphqlRequest{Query: q, Variables: vars})
	req, err := http.NewRequestWithContext(ctx, "POST", c.url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
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
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody[:min(300, len(respBody))]))
	}

	var gql graphqlResponse
	if err := json.Unmarshal(respBody, &gql); err != nil {
		return nil, err
	}
	if len(gql.Errors) > 0 {
		return nil, fmt.Errorf("OSO GraphQL error: %s", gql.Errors[0].Message)
	}
	return gql.Data, nil
}

// --- Projects ---

type OSOProject struct {
	ProjectID     string `json:"projectId"`
	ProjectName   string `json:"projectName"`
	ProjectSource string `json:"projectSource"`
	DisplayName   string `json:"displayName"`
	Description   string `json:"description"`
}

func (c *OSOClient) GetProjects(ctx context.Context, limit int) ([]OSOProject, error) {
	q := `query GetProjects($limit: Int!) {
		oso_projectsV1(limit: $limit) {
			projectId projectName projectSource displayName description
		}
	}`
	data, err := c.query(ctx, q, map[string]any{"limit": limit})
	if err != nil {
		return nil, err
	}
	var result struct {
		Projects []OSOProject `json:"oso_projectsV1"`
	}
	return result.Projects, json.Unmarshal(data, &result)
}

// --- Metrics ---

type OSOMetric struct {
	MetricID   string  `json:"metricId"`
	ProjectID  string  `json:"projectId"`
	SampleDate string  `json:"sampleDate"`
	Amount     float64 `json:"amount"`
}

func (c *OSOClient) GetProjectMetrics(ctx context.Context, projectID string) ([]OSOMetric, error) {
	q := `query GetMetrics($projectId: String!) {
		oso_timeseriesMetricsByProjectV0(
			where: { projectId: { _eq: $projectId } }
			limit: 500
			order_by: { sampleDate: desc }
		) {
			metricId projectId sampleDate amount
		}
	}`
	data, err := c.query(ctx, q, map[string]any{"projectId": projectID})
	if err != nil {
		return nil, err
	}
	var result struct {
		Metrics []OSOMetric `json:"oso_timeseriesMetricsByProjectV0"`
	}
	return result.Metrics, json.Unmarshal(data, &result)
}

// --- Code Metrics ---

type CodeMetrics struct {
	ProjectID                string  `json:"projectId"`
	ProjectName              string  `json:"projectName"`
	StarCount                float64 `json:"starCount"`
	ForkCount                float64 `json:"forkCount"`
	ContributorCount         float64 `json:"contributorCount"`
	ContributorCount6Months  float64 `json:"contributorCount6Months"`
	CommitCount6Months       float64 `json:"commitCount6Months"`
	ActiveDevCount6Months    float64 `json:"activeDeveloperCount6Months"`
	MergedPRCount6Months     float64 `json:"mergedPullRequestCount6Months"`
	OpenedIssueCount6Months  float64 `json:"openedIssueCount6Months"`
	ClosedIssueCount6Months  float64 `json:"closedIssueCount6Months"`
	RepositoryCount          float64 `json:"repositoryCount"`
}

func (c *OSOClient) GetCodeMetrics(ctx context.Context, projectName string) (*CodeMetrics, error) {
	q := `query GetCodeMetrics($name: String!) {
		oso_codeMetricsByProjectV1(
			where: { projectName: { _eq: $name } }
			limit: 1
		) {
			projectId projectName starCount forkCount
			contributorCount contributorCount6Months
			commitCount6Months activeDeveloperCount6Months
			mergedPullRequestCount6Months openedIssueCount6Months
			closedIssueCount6Months repositoryCount
		}
	}`
	data, err := c.query(ctx, q, map[string]any{"name": projectName})
	if err != nil {
		return nil, err
	}
	var result struct {
		Metrics []CodeMetrics `json:"oso_codeMetricsByProjectV1"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	if len(result.Metrics) == 0 {
		return nil, fmt.Errorf("no code metrics found for project %s", projectName)
	}
	return &result.Metrics[0], nil
}

// --- On-Chain Metrics ---

type OnchainMetrics struct {
	ProjectID                   string  `json:"projectId"`
	ProjectName                 string  `json:"projectName"`
	TransactionCount6Months     float64 `json:"transactionCount6Months"`
	GasFeesSum6Months           float64 `json:"gasFeesSum6Months"`
	ActiveContractCount90Days   float64 `json:"activeContractCount90Days"`
	AddressCount90Days          float64 `json:"addressCount90Days"`
	NewAddressCount90Days       float64 `json:"newAddressCount90Days"`
	ReturningAddressCount90Days float64 `json:"returningAddressCount90Days"`
}

func (c *OSOClient) GetOnchainMetrics(ctx context.Context, projectName string) (*OnchainMetrics, error) {
	q := `query GetOnchainMetrics($name: String!) {
		oso_onchainMetricsByProjectV1(
			where: { projectName: { _eq: $name } }
			limit: 1
		) {
			projectId projectName transactionCount6Months
			gasFeesSum6Months activeContractCount90Days
			addressCount90Days newAddressCount90Days
			returningAddressCount90Days
		}
	}`
	data, err := c.query(ctx, q, map[string]any{"name": projectName})
	if err != nil {
		return nil, err
	}
	var result struct {
		Metrics []OnchainMetrics `json:"oso_onchainMetricsByProjectV1"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	if len(result.Metrics) == 0 {
		return nil, fmt.Errorf("no on-chain metrics found for project %s", projectName)
	}
	return &result.Metrics[0], nil
}

// --- Funding Metrics ---

type FundingMetrics struct {
	ProjectID                    string  `json:"projectId"`
	ProjectName                  string  `json:"projectName"`
	TotalFundingReceivedUSD      float64 `json:"totalFundingReceivedUsd6Months"`
	GrantCount                   float64 `json:"grantCount"`
}

func (c *OSOClient) GetFundingMetrics(ctx context.Context, projectName string) (*FundingMetrics, error) {
	q := `query GetFundingMetrics($name: String!) {
		oso_fundingMetricsByProjectV1(
			where: { projectName: { _eq: $name } }
			limit: 1
		) {
			projectId projectName totalFundingReceivedUsd6Months grantCount
		}
	}`
	data, err := c.query(ctx, q, map[string]any{"name": projectName})
	if err != nil {
		return nil, err
	}
	var result struct {
		Metrics []FundingMetrics `json:"oso_fundingMetricsByProjectV1"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	if len(result.Metrics) == 0 {
		return nil, fmt.Errorf("no funding metrics found for project %s", projectName)
	}
	return &result.Metrics[0], nil
}

// --- Project Search ---

func (c *OSOClient) SearchProjects(ctx context.Context, query string, limit int) ([]OSOProject, error) {
	q := `query SearchProjects($query: String!, $limit: Int!) {
		oso_projectsV1(
			where: { projectName: { _ilike: $query } }
			limit: $limit
		) {
			projectId projectName projectSource displayName description
		}
	}`
	data, err := c.query(ctx, q, map[string]any{"query": "%" + query + "%", "limit": limit})
	if err != nil {
		return nil, err
	}
	var result struct {
		Projects []OSOProject `json:"oso_projectsV1"`
	}
	return result.Projects, json.Unmarshal(data, &result)
}

// --- Collect All Signals ---

// ProjectSignals aggregates all available OSO signals for a project.
type ProjectSignals struct {
	Name     string
	Code     *CodeMetrics
	Onchain  *OnchainMetrics
	Funding  *FundingMetrics
}

// CollectProjectSignals fetches all available metrics for a project name.
// Non-fatal: individual metric failures are silently skipped.
func (c *OSOClient) CollectProjectSignals(ctx context.Context, projectName string) *ProjectSignals {
	signals := &ProjectSignals{Name: projectName}
	signals.Code, _ = c.GetCodeMetrics(ctx, projectName)
	signals.Onchain, _ = c.GetOnchainMetrics(ctx, projectName)
	signals.Funding, _ = c.GetFundingMetrics(ctx, projectName)
	return signals
}

// FormatSignals returns a human-readable summary of all collected signals.
func (s *ProjectSignals) FormatSignals() string {
	if s.Code == nil && s.Onchain == nil && s.Funding == nil {
		return "No OSO data available for this project."
	}

	var b strings.Builder
	if s.Code != nil {
		b.WriteString("### Code Activity (GitHub)\n")
		b.WriteString(fmt.Sprintf("- Stars: %.0f | Forks: %.0f | Repos: %.0f\n", s.Code.StarCount, s.Code.ForkCount, s.Code.RepositoryCount))
		b.WriteString(fmt.Sprintf("- Contributors (all time): %.0f | (6mo): %.0f\n", s.Code.ContributorCount, s.Code.ContributorCount6Months))
		b.WriteString(fmt.Sprintf("- Commits (6mo): %.0f | Active Devs (6mo): %.0f\n", s.Code.CommitCount6Months, s.Code.ActiveDevCount6Months))
		b.WriteString(fmt.Sprintf("- Merged PRs (6mo): %.0f | Issues opened/closed (6mo): %.0f/%.0f\n",
			s.Code.MergedPRCount6Months, s.Code.OpenedIssueCount6Months, s.Code.ClosedIssueCount6Months))
		b.WriteString("\n")
	}
	if s.Onchain != nil {
		b.WriteString("### On-Chain Activity\n")
		b.WriteString(fmt.Sprintf("- Transactions (6mo): %.0f | Gas fees (6mo): %.2f\n", s.Onchain.TransactionCount6Months, s.Onchain.GasFeesSum6Months))
		b.WriteString(fmt.Sprintf("- Active contracts (90d): %.0f\n", s.Onchain.ActiveContractCount90Days))
		b.WriteString(fmt.Sprintf("- Addresses (90d): %.0f total | %.0f new | %.0f returning\n",
			s.Onchain.AddressCount90Days, s.Onchain.NewAddressCount90Days, s.Onchain.ReturningAddressCount90Days))
		b.WriteString("\n")
	}
	if s.Funding != nil {
		b.WriteString("### Funding (Cross-Platform)\n")
		b.WriteString(fmt.Sprintf("- Total funding received (6mo): $%.2f\n", s.Funding.TotalFundingReceivedUSD))
		b.WriteString(fmt.Sprintf("- Grant count: %.0f\n", s.Funding.GrantCount))
		b.WriteString("\n")
	}
	return b.String()
}
