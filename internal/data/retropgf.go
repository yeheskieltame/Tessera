package data

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// RetroPGFClient queries Optimism RetroPGF data for cross-ecosystem validation.
type RetroPGFClient struct {
	client *http.Client
}

func NewRetroPGFClient() *RetroPGFClient {
	return &RetroPGFClient{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// RetroPGFProject holds a project from the RetroPGF Round 3 API.
type RetroPGFProject struct {
	ID              string `json:"id"`
	DisplayName     string `json:"displayName"`
	Bio             string `json:"bio"`
	ApplicantType   string `json:"applicantType"`
	WebsiteURL      string `json:"websiteUrl"`
	ImpactCategory  []string `json:"impactCategory"`
	ContributionDesc string `json:"contributionDescription"`
	ImpactDesc      string `json:"impactDescription"`
	PayoutAddress   string `json:"payoutAddress"`
	ContributionLinks []struct {
		Type string `json:"type"`
		URL  string `json:"url"`
		Desc string `json:"description"`
	} `json:"contributionLinks"`
	ImpactMetrics []struct {
		Description string  `json:"description"`
		Number      float64 `json:"number"`
		URL         string  `json:"url"`
	} `json:"impactMetrics"`
	FundingSources []struct {
		Type     string  `json:"type"`
		Currency string  `json:"currency"`
		Amount   float64 `json:"amount"`
		Desc     string  `json:"description"`
	} `json:"fundingSources"`
}

// GetRound3Projects fetches all RetroPGF Round 3 project applications.
func (c *RetroPGFClient) GetRound3Projects(ctx context.Context) ([]RetroPGFProject, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://round3.optimism.io/api/projects", nil)
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
		return nil, fmt.Errorf("RetroPGF API %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}
	var projects []RetroPGFProject
	return projects, json.Unmarshal(body, &projects)
}

// CrossEcosystemPresence holds cross-ecosystem validation data.
type CrossEcosystemPresence struct {
	// RetroPGF
	InRetroPGF       bool              `json:"inRetroPGF"`
	RetroPGFProject  *RetroPGFProject  `json:"retroPGFProject,omitempty"`
	RetroPGFCategories []string         `json:"retroPGFCategories,omitempty"`
	RetroPGFFunding  float64           `json:"retroPGFFunding"`  // total from all funding sources
	// Optimism governance discourse
	OptimismDiscourse *CommunitySignals `json:"optimismDiscourse,omitempty"`
}

// FindInRetroPGF searches for a project by name, address, or GitHub URL in RetroPGF Round 3.
func (c *RetroPGFClient) FindInRetroPGF(ctx context.Context, projectName string, address string, githubURL string) *CrossEcosystemPresence {
	result := &CrossEcosystemPresence{}

	projects, err := c.GetRound3Projects(ctx)
	if err != nil || len(projects) == 0 {
		return result
	}

	normalizedName := strings.ToLower(projectName)
	normalizedAddr := strings.ToLower(address)
	normalizedGH := strings.ToLower(githubURL)

	for i, p := range projects {
		matched := false

		// Match by name (fuzzy)
		if normalizedName != "" && strings.Contains(strings.ToLower(p.DisplayName), normalizedName) {
			matched = true
		}

		// Match by payout address
		if !matched && normalizedAddr != "" && strings.EqualFold(p.PayoutAddress, normalizedAddr) {
			matched = true
		}

		// Match by GitHub URL in contribution links
		if !matched && normalizedGH != "" {
			for _, link := range p.ContributionLinks {
				if strings.Contains(strings.ToLower(link.URL), normalizedGH) {
					matched = true
					break
				}
			}
		}

		// Match by website URL containing project name
		if !matched && normalizedName != "" && strings.Contains(strings.ToLower(p.WebsiteURL), normalizedName) {
			matched = true
		}

		if matched {
			result.InRetroPGF = true
			result.RetroPGFProject = &projects[i]
			result.RetroPGFCategories = p.ImpactCategory

			// Sum all funding sources
			for _, fs := range p.FundingSources {
				result.RetroPGFFunding += fs.Amount
			}
			break
		}
	}

	// Also check Optimism governance discourse
	optDiscourse := NewDiscourseClient("https://gov.optimism.io")
	if projectName != "" {
		result.OptimismDiscourse = optDiscourse.CollectCommunitySignals(ctx, projectName)
	}

	return result
}

// FormatCrossEcosystem returns markdown summary.
func FormatCrossEcosystem(p *CrossEcosystemPresence) string {
	if p == nil {
		return ""
	}

	var b strings.Builder
	b.WriteString("### Cross-Ecosystem Validation\n\n")

	if p.InRetroPGF && p.RetroPGFProject != nil {
		rp := p.RetroPGFProject
		b.WriteString("**Optimism RetroPGF Round 3:** Found\n")
		b.WriteString(fmt.Sprintf("- Name: %s\n", rp.DisplayName))
		b.WriteString(fmt.Sprintf("- Type: %s\n", rp.ApplicantType))
		if len(rp.ImpactCategory) > 0 {
			b.WriteString(fmt.Sprintf("- Impact categories: %s\n", strings.Join(rp.ImpactCategory, ", ")))
		}
		if p.RetroPGFFunding > 0 {
			b.WriteString(fmt.Sprintf("- Total funding disclosed: $%.0f\n", p.RetroPGFFunding))
		}
		if len(rp.ImpactMetrics) > 0 {
			b.WriteString("- Impact metrics:\n")
			for _, m := range rp.ImpactMetrics {
				if m.Number > 0 {
					b.WriteString(fmt.Sprintf("  - %s: %.0f\n", m.Description, m.Number))
				}
			}
		}
		b.WriteString("\n")
		b.WriteString("**Signal:** Independent validation — project was evaluated and accepted by Optimism RetroPGF badgeholders, a separate community from Octant.\n\n")
	} else {
		b.WriteString("**Optimism RetroPGF Round 3:** Not found\n\n")
	}

	if p.OptimismDiscourse != nil && p.OptimismDiscourse.TopicsFound > 0 {
		b.WriteString(p.OptimismDiscourse.FormatCommunitySignals())
	}

	return b.String()
}
