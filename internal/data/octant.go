package data

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"
)

const OctantBaseURL = "https://backend.mainnet.octant.app"

type OctantClient struct {
	baseURL string
	client  *http.Client
}

func NewOctantClient() *OctantClient {
	return &OctantClient{
		baseURL: OctantBaseURL,
		client:  &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *OctantClient) get(ctx context.Context, path string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
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

// --- Epoch ---

type EpochCurrent struct {
	CurrentEpoch int `json:"currentEpoch"`
}

func (c *OctantClient) GetCurrentEpoch(ctx context.Context) (*EpochCurrent, error) {
	data, err := c.get(ctx, "/epochs/current")
	if err != nil {
		return nil, err
	}
	var result EpochCurrent
	return &result, json.Unmarshal(data, &result)
}

type EpochInfo struct {
	StakingProceeds  string `json:"stakingProceeds"`
	TotalEffective   string `json:"totalEffective"`
	TotalRewards     string `json:"totalRewards"`
	VanillaRewards   string `json:"vanillaRewards"`
	OperationalCost  string `json:"operationalCost"`
	TotalWithdrawals string `json:"totalWithdrawals"`
}

func (c *OctantClient) GetEpochInfo(ctx context.Context, epoch int) (*EpochInfo, error) {
	data, err := c.get(ctx, fmt.Sprintf("/epochs/info/%d", epoch))
	if err != nil {
		return nil, err
	}
	var result EpochInfo
	return &result, json.Unmarshal(data, &result)
}

// --- Projects ---

type ProjectsResponse struct {
	ProjectsAddresses []string `json:"projectsAddresses"`
}

func (c *OctantClient) GetProjects(ctx context.Context, epoch int) ([]string, error) {
	data, err := c.get(ctx, fmt.Sprintf("/projects/epoch/%d", epoch))
	if err != nil {
		return nil, err
	}
	var result ProjectsResponse
	if err := json.Unmarshal(data, &result); err != nil {
		// Try as plain array
		var addrs []string
		if err2 := json.Unmarshal(data, &addrs); err2 != nil {
			return nil, err
		}
		return addrs, nil
	}
	return result.ProjectsAddresses, nil
}

// --- Rewards ---

type ProjectReward struct {
	Address   string `json:"address"`
	Allocated string `json:"allocated"`
	Matched   string `json:"matched"`
}

type RewardsResponse struct {
	Rewards []ProjectReward `json:"rewards"`
}

func (c *OctantClient) GetProjectRewards(ctx context.Context, epoch int) ([]ProjectReward, error) {
	data, err := c.get(ctx, fmt.Sprintf("/rewards/projects/epoch/%d", epoch))
	if err != nil {
		return nil, err
	}
	var result RewardsResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result.Rewards, nil
}

// --- Allocations ---

type Allocation struct {
	Donor   string `json:"donor"`
	Amount  string `json:"amount"`
	Project string `json:"project"`
}

type AllocationsResponse struct {
	Allocations []Allocation `json:"allocations"`
}

func (c *OctantClient) GetAllocations(ctx context.Context, epoch int) ([]Allocation, error) {
	data, err := c.get(ctx, fmt.Sprintf("/allocations/epoch/%d", epoch))
	if err != nil {
		return nil, err
	}
	var result AllocationsResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result.Allocations, nil
}

// --- Donors ---

type DonorsResponse struct {
	Donors []string `json:"donors"`
}

func (c *OctantClient) GetDonors(ctx context.Context, epoch int) ([]string, error) {
	data, err := c.get(ctx, fmt.Sprintf("/allocations/donors/%d", epoch))
	if err != nil {
		return nil, err
	}
	var result DonorsResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result.Donors, nil
}

// --- Patrons ---

type PatronsResponse struct {
	Patrons []string `json:"patrons"`
}

func (c *OctantClient) GetPatrons(ctx context.Context, epoch int) ([]string, error) {
	data, err := c.get(ctx, fmt.Sprintf("/user/patrons/%d", epoch))
	if err != nil {
		return nil, err
	}
	var result PatronsResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result.Patrons, nil
}

// --- Budgets ---

type Budget struct {
	Address string `json:"address"`
	Amount  string `json:"amount"`
}

type BudgetsResponse struct {
	Budgets []Budget `json:"budgets"`
}

func (c *OctantClient) GetBudgets(ctx context.Context, epoch int) ([]Budget, error) {
	data, err := c.get(ctx, fmt.Sprintf("/rewards/budgets/epoch/%d", epoch))
	if err != nil {
		return nil, err
	}
	var result BudgetsResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result.Budgets, nil
}

// --- Leverage ---

func (c *OctantClient) GetLeverage(ctx context.Context, epoch int) (json.RawMessage, error) {
	data, err := c.get(ctx, fmt.Sprintf("/rewards/leverage/%d", epoch))
	if err != nil {
		return nil, err
	}
	return data, nil
}

// --- Threshold ---

type ThresholdResponse struct {
	Threshold string `json:"threshold"`
}

func (c *OctantClient) GetThreshold(ctx context.Context, epoch int) (string, error) {
	data, err := c.get(ctx, fmt.Sprintf("/rewards/threshold/%d", epoch))
	if err != nil {
		return "", err
	}
	var result ThresholdResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return "", err
	}
	return result.Threshold, nil
}

// --- Cross-Epoch History ---

// ProjectEpochData holds a project's funding data for a single epoch.
type ProjectEpochData struct {
	Epoch     int
	Allocated float64
	Matched   float64
	Donors    int
}

// GetProjectHistory fetches a project's rewards across multiple epochs.
// It iterates from fromEpoch to toEpoch, collecting allocated/matched funding
// (converted from wei to ETH) and donor count per epoch. Epochs where the
// project is not found are silently skipped.
func (c *OctantClient) GetProjectHistory(ctx context.Context, address string, fromEpoch, toEpoch int) ([]ProjectEpochData, error) {
	if fromEpoch > toEpoch {
		return nil, fmt.Errorf("fromEpoch (%d) must be <= toEpoch (%d)", fromEpoch, toEpoch)
	}

	normalizedAddr := strings.ToLower(address)
	var history []ProjectEpochData

	for epoch := fromEpoch; epoch <= toEpoch; epoch++ {
		rewards, err := c.GetProjectRewards(ctx, epoch)
		if err != nil {
			// Skip epochs that return errors (e.g., epoch doesn't exist yet)
			continue
		}

		// Find the project in this epoch's rewards
		var found bool
		var epData ProjectEpochData
		for _, r := range rewards {
			if strings.ToLower(r.Address) == normalizedAddr {
				epData = ProjectEpochData{
					Epoch:     epoch,
					Allocated: weiToEth(r.Allocated),
					Matched:   weiToEth(r.Matched),
				}
				found = true
				break
			}
		}
		if !found {
			continue
		}

		// Count unique donors for this project in this epoch
		allocations, err := c.GetAllocations(ctx, epoch)
		if err == nil {
			donors := map[string]bool{}
			for _, a := range allocations {
				if strings.ToLower(a.Project) == normalizedAddr {
					donors[strings.ToLower(a.Donor)] = true
				}
			}
			epData.Donors = len(donors)
		}

		history = append(history, epData)
	}

	return history, nil
}

// weiToEth converts a wei string to ETH float64.
// This is a local copy to avoid circular imports with the analysis package.
func weiToEth(wei string) float64 {
	n := new(big.Int)
	n.SetString(wei, 10)
	f := new(big.Float).SetInt(n)
	eth, _ := new(big.Float).Quo(f, big.NewFloat(1e18)).Float64()
	return eth
}
