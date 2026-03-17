package data

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const GitcoinGraphQLURL = "https://grants-stack-indexer-v2.gitcoin.co/graphql"

type GitcoinClient struct {
	url    string
	client *http.Client
}

func NewGitcoinClient() *GitcoinClient {
	return &GitcoinClient{
		url:    GitcoinGraphQLURL,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

type graphqlRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables"`
}

type graphqlResponse struct {
	Data   json.RawMessage `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func (c *GitcoinClient) query(ctx context.Context, q string, vars map[string]any) (json.RawMessage, error) {
	body, _ := json.Marshal(graphqlRequest{Query: q, Variables: vars})
	req, err := http.NewRequestWithContext(ctx, "POST", c.url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

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
		return nil, fmt.Errorf("GraphQL error: %s", gql.Errors[0].Message)
	}
	return gql.Data, nil
}

// --- Rounds ---

type Round struct {
	ID                      string          `json:"id"`
	ChainID                 int             `json:"chainId"`
	RoundMetadata           json.RawMessage `json:"roundMetadata"`
	MatchAmount             string          `json:"matchAmount"`
	MatchTokenAddress       string          `json:"matchTokenAddress"`
	ApplicationsStartTime  string          `json:"applicationsStartTime"`
	ApplicationsEndTime    string          `json:"applicationsEndTime"`
	DonationsStartTime     string          `json:"donationsStartTime"`
	DonationsEndTime       string          `json:"donationsEndTime"`
	TotalDonationsCount    int             `json:"totalDonationsCount"`
	UniqueDonorsCount      int             `json:"uniqueDonorsCount"`
	TotalAmountDonatedInUsd float64        `json:"totalAmountDonatedInUsd"`
	MatchAmountInUsd       float64         `json:"matchAmountInUsd"`
}

func (c *GitcoinClient) GetRounds(ctx context.Context, chainID, first int) ([]Round, error) {
	q := `query GetRounds($chainId: Int!, $first: Int!) {
		rounds(
			filter: { chainId: { equalTo: $chainId } }
			first: $first
			orderBy: CREATED_AT_BLOCK_DESC
		) {
			nodes {
				id chainId roundMetadata matchAmount matchTokenAddress
				applicationsStartTime applicationsEndTime
				donationsStartTime donationsEndTime
				totalDonationsCount uniqueDonorsCount
				totalAmountDonatedInUsd matchAmountInUsd
			}
		}
	}`
	data, err := c.query(ctx, q, map[string]any{"chainId": chainID, "first": first})
	if err != nil {
		return nil, err
	}
	var result struct {
		Rounds struct {
			Nodes []Round `json:"nodes"`
		} `json:"rounds"`
	}
	return result.Rounds.Nodes, json.Unmarshal(data, &result)
}

// --- Applications ---

type Application struct {
	ID                      string          `json:"id"`
	ProjectID               string          `json:"projectId"`
	Status                  string          `json:"status"`
	Metadata                json.RawMessage `json:"metadata"`
	TotalDonationsCount     int             `json:"totalDonationsCount"`
	UniqueDonorsCount       int             `json:"uniqueDonorsCount"`
	TotalAmountDonatedInUsd float64         `json:"totalAmountDonatedInUsd"`
}

func (c *GitcoinClient) GetRoundProjects(ctx context.Context, roundID string, chainID int) ([]Application, error) {
	q := `query GetApplications($roundId: String!, $chainId: Int!) {
		applications(
			filter: {
				roundId: { equalTo: $roundId }
				chainId: { equalTo: $chainId }
				status: { equalTo: APPROVED }
			}
		) {
			nodes {
				id projectId status metadata
				totalDonationsCount uniqueDonorsCount totalAmountDonatedInUsd
			}
		}
	}`
	data, err := c.query(ctx, q, map[string]any{"roundId": roundID, "chainId": chainID})
	if err != nil {
		return nil, err
	}
	var result struct {
		Applications struct {
			Nodes []Application `json:"nodes"`
		} `json:"applications"`
	}
	return result.Applications.Nodes, json.Unmarshal(data, &result)
}

// --- Donations ---

type Donation struct {
	ID               string  `json:"id"`
	DonorAddress     string  `json:"donorAddress"`
	RecipientAddress string  `json:"recipientAddress"`
	ProjectID        string  `json:"projectId"`
	AmountInUsd      float64 `json:"amountInUsd"`
	TransactionHash  string  `json:"transactionHash"`
}

func (c *GitcoinClient) GetDonations(ctx context.Context, roundID string, chainID, first int) ([]Donation, error) {
	q := `query GetDonations($roundId: String!, $chainId: Int!, $first: Int!) {
		donations(
			filter: { roundId: { equalTo: $roundId }, chainId: { equalTo: $chainId } }
			first: $first
			orderBy: AMOUNT_IN_USD_DESC
		) {
			nodes {
				id donorAddress recipientAddress projectId amountInUsd transactionHash
			}
		}
	}`
	data, err := c.query(ctx, q, map[string]any{"roundId": roundID, "chainId": chainID, "first": first})
	if err != nil {
		return nil, err
	}
	var result struct {
		Donations struct {
			Nodes []Donation `json:"nodes"`
		} `json:"donations"`
	}
	return result.Donations.Nodes, json.Unmarshal(data, &result)
}
