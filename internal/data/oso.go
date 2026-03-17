package data

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
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
