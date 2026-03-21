package analysis

import (
	"fmt"
	"strings"

	"github.com/yeheskieltame/tessera/internal/data"
)

// ReliabilityTier classifies signal trustworthiness.
type ReliabilityTier string

const (
	ReliabilityHigh   ReliabilityTier = "HIGH"
	ReliabilityMedium ReliabilityTier = "MEDIUM"
	ReliabilityLow    ReliabilityTier = "LOW"
)

// SignalReliability describes a single signal's trustworthiness.
type SignalReliability struct {
	Source      string          `json:"source"`
	Signal      string          `json:"signal"`
	Tier        ReliabilityTier `json:"tier"`
	Reason      string          `json:"reason"`
	Gameable    bool            `json:"gameable"`    // can this signal be easily faked?
	Immutable   bool            `json:"immutable"`   // is this signal on-chain / immutable?
	Independent bool            `json:"independent"` // is this from an independent source (not self-reported)?
	Value       string          `json:"value"`       // the actual signal value
}

// ReliabilityReport aggregates all signal reliability assessments.
type ReliabilityReport struct {
	Signals          []SignalReliability `json:"signals"`
	OverallScore     float64            `json:"overallScore"`     // 0-100 weighted reliability
	HighCount        int                `json:"highCount"`
	MediumCount      int                `json:"mediumCount"`
	LowCount         int                `json:"lowCount"`
	DataCompleteness float64            `json:"dataCompleteness"` // 0-100, how many signal categories have data
}

// AssessReliability evaluates reliability of all collected signals for a project.
func AssessReliability(
	trust *TrustProfile,
	chain *data.ChainSignals,
	osoMetrics string,
	history []data.ProjectEpochData,
	hasGitHub bool,
	anomalyCount int,
) *ReliabilityReport {
	report := &ReliabilityReport{}

	// === ON-CHAIN SIGNALS (HIGH reliability — immutable, verifiable) ===

	if chain != nil && chain.TotalChainsActive > 0 {
		report.Signals = append(report.Signals, SignalReliability{
			Source:      "Blockchain RPC",
			Signal:      "Native balance & transaction count",
			Tier:        ReliabilityHigh,
			Reason:      "On-chain data is immutable and independently verifiable by any node",
			Gameable:    false,
			Immutable:   true,
			Independent: true,
			Value:       fmt.Sprintf("%.4f ETH across %d chains, %d txs", chain.TotalBalance, chain.TotalChainsActive, chain.TotalTxCount),
		})

		if chain.HasContracts {
			report.Signals = append(report.Signals, SignalReliability{
				Source:      "Blockchain RPC",
				Signal:      "Deployed smart contracts",
				Tier:        ReliabilityHigh,
				Reason:      "Contract deployment is an on-chain action that requires gas expenditure",
				Gameable:    false,
				Immutable:   true,
				Independent: true,
				Value:       "Contract(s) deployed on-chain",
			})
		}

		if chain.HasStablecoins {
			tokenParts := []string{}
			for symbol, amount := range chain.TotalTokens {
				tokenParts = append(tokenParts, fmt.Sprintf("%s: $%.2f", symbol, amount))
			}
			report.Signals = append(report.Signals, SignalReliability{
				Source:      "Blockchain RPC",
				Signal:      "ERC-20 stablecoin holdings",
				Tier:        ReliabilityHigh,
				Reason:      "Token balances are verifiable on-chain via contract state",
				Gameable:    false,
				Immutable:   true,
				Independent: true,
				Value:       strings.Join(tokenParts, ", "),
			})
		}
	}

	// === OCTANT PROTOCOL SIGNALS (HIGH reliability — protocol-verified) ===

	if len(history) > 0 {
		var totalFunding float64
		for _, h := range history {
			totalFunding += h.Allocated + h.Matched
		}
		report.Signals = append(report.Signals, SignalReliability{
			Source:      "Octant Protocol",
			Signal:      "Cross-epoch funding history",
			Tier:        ReliabilityHigh,
			Reason:      "Funding data comes directly from Octant's smart contracts and verified backend",
			Gameable:    false,
			Immutable:   true,
			Independent: true,
			Value:       fmt.Sprintf("%.4f ETH total across %d epochs", totalFunding, len(history)),
		})
	}

	// === TRUST GRAPH SIGNALS (HIGH reliability — computed from on-chain data) ===

	if trust != nil {
		report.Signals = append(report.Signals, SignalReliability{
			Source:      "Trust Graph (computed)",
			Signal:      "Donor diversity (Shannon entropy)",
			Tier:        ReliabilityHigh,
			Reason:      "Mathematically computed from verified allocation data — cannot be self-reported or faked without changing actual donations",
			Gameable:    false,
			Immutable:   true,
			Independent: true,
			Value:       fmt.Sprintf("%.3f (1.0 = perfectly diverse)", trust.DonorDiversity),
		})

		report.Signals = append(report.Signals, SignalReliability{
			Source:      "Trust Graph (computed)",
			Signal:      "Whale dependency ratio",
			Tier:        ReliabilityHigh,
			Reason:      "Derived from actual on-chain allocation amounts",
			Gameable:    false,
			Immutable:   true,
			Independent: true,
			Value:       fmt.Sprintf("%.1f%% from top donor", trust.WhaleDepRatio*100),
		})

		report.Signals = append(report.Signals, SignalReliability{
			Source:      "Trust Graph (computed)",
			Signal:      "Coordination risk (Jaccard similarity)",
			Tier:        ReliabilityHigh,
			Reason:      "Graph-theoretic measure of donor overlap — detects coordinated behavior from on-chain data",
			Gameable:    false,
			Immutable:   true,
			Independent: true,
			Value:       fmt.Sprintf("%.3f max Jaccard with other projects", trust.CoordinationRisk),
		})
	}

	// === ANOMALY DETECTION (HIGH — computed from protocol data) ===

	if anomalyCount > 0 {
		report.Signals = append(report.Signals, SignalReliability{
			Source:      "Temporal Analysis (computed)",
			Signal:      "Cross-epoch anomaly detection",
			Tier:        ReliabilityHigh,
			Reason:      "Anomalies detected by comparing verified on-chain data across epochs",
			Gameable:    false,
			Immutable:   true,
			Independent: true,
			Value:       fmt.Sprintf("%d anomalies detected", anomalyCount),
		})
	}

	// === OSO METRICS (MEDIUM reliability — aggregated from multiple sources) ===

	if osoMetrics != "" {
		report.Signals = append(report.Signals, SignalReliability{
			Source:      "Open Source Observer",
			Signal:      "Code activity metrics (commits, PRs, contributors)",
			Tier:        ReliabilityMedium,
			Reason:      "Aggregated from GitHub — commit counts can be inflated but contributor diversity is harder to fake",
			Gameable:    true,
			Immutable:   false,
			Independent: true,
			Value:       "See OSO metrics section",
		})

		report.Signals = append(report.Signals, SignalReliability{
			Source:      "Open Source Observer",
			Signal:      "On-chain usage metrics (txs, users, gas)",
			Tier:        ReliabilityMedium,
			Reason:      "Based on on-chain data but aggregated by a third party — subject to indexing delays",
			Gameable:    false,
			Immutable:   false,
			Independent: true,
			Value:       "See OSO metrics section",
		})
	}

	// === GITHUB SIGNALS (MIXED reliability) ===

	if hasGitHub {
		report.Signals = append(report.Signals, SignalReliability{
			Source:      "GitHub API",
			Signal:      "Stars and forks count",
			Tier:        ReliabilityLow,
			Reason:      "Easily gameable via star farms and bot forks — low cost to inflate",
			Gameable:    true,
			Immutable:   false,
			Independent: false,
			Value:       "See GitHub section",
		})

		report.Signals = append(report.Signals, SignalReliability{
			Source:      "GitHub API",
			Signal:      "Unique contributor count & commit frequency",
			Tier:        ReliabilityMedium,
			Reason:      "Harder to fake than stars — requires actual code contributions, but can still be inflated with bot commits",
			Gameable:    true,
			Immutable:   false,
			Independent: true,
			Value:       "See GitHub section",
		})

		report.Signals = append(report.Signals, SignalReliability{
			Source:      "GitHub API",
			Signal:      "Last push date & repository activity",
			Tier:        ReliabilityMedium,
			Reason:      "Indicates ongoing development — faking sustained activity over months is expensive",
			Gameable:    true,
			Immutable:   false,
			Independent: true,
			Value:       "See GitHub section",
		})
	}

	// === SELF-REPORTED SIGNALS (LOW reliability) ===

	report.Signals = append(report.Signals, SignalReliability{
		Source:      "Project Proposal",
		Signal:      "Self-reported impact claims and descriptions",
		Tier:        ReliabilityLow,
		Reason:      "Self-reported by project team — requires independent verification via scan-proposal",
		Gameable:    true,
		Immutable:   false,
		Independent: false,
		Value:       "Verified via two-pass proposal scanning when available",
	})

	// Compute summary stats
	totalCategories := 7 // blockchain, octant, trust, temporal, oso, github, self-reported
	filledCategories := 0

	if chain != nil && chain.TotalChainsActive > 0 {
		filledCategories++
	}
	if len(history) > 0 {
		filledCategories++
	}
	if trust != nil {
		filledCategories++
	}
	if anomalyCount > 0 {
		filledCategories++
	}
	if osoMetrics != "" {
		filledCategories++
	}
	if hasGitHub {
		filledCategories++
	}
	// Self-reported is always "available" (it's the proposal itself)
	filledCategories++

	report.DataCompleteness = float64(filledCategories) / float64(totalCategories) * 100

	for _, s := range report.Signals {
		switch s.Tier {
		case ReliabilityHigh:
			report.HighCount++
		case ReliabilityMedium:
			report.MediumCount++
		case ReliabilityLow:
			report.LowCount++
		}
	}

	// Overall score: weighted by tier (high=1.0, medium=0.6, low=0.2)
	if len(report.Signals) > 0 {
		totalWeight := 0.0
		for _, s := range report.Signals {
			switch s.Tier {
			case ReliabilityHigh:
				totalWeight += 1.0
			case ReliabilityMedium:
				totalWeight += 0.6
			case ReliabilityLow:
				totalWeight += 0.2
			}
		}
		report.OverallScore = (totalWeight / float64(len(report.Signals))) * 100
	}

	return report
}

// FormatReliabilityReport produces a markdown summary.
func FormatReliabilityReport(r *ReliabilityReport) string {
	if r == nil || len(r.Signals) == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString("### Signal Reliability Assessment\n\n")
	b.WriteString(fmt.Sprintf("**Overall Reliability Score:** %.0f/100 | **Data Completeness:** %.0f%%\n", r.OverallScore, r.DataCompleteness))
	b.WriteString(fmt.Sprintf("**Signal breakdown:** %d HIGH | %d MEDIUM | %d LOW\n\n", r.HighCount, r.MediumCount, r.LowCount))

	// Group by tier
	b.WriteString("**HIGH reliability** (immutable, independently verifiable):\n")
	for _, s := range r.Signals {
		if s.Tier == ReliabilityHigh {
			b.WriteString(fmt.Sprintf("- [%s] %s — %s\n", s.Source, s.Signal, s.Value))
		}
	}

	b.WriteString("\n**MEDIUM reliability** (independent but potentially gameable):\n")
	for _, s := range r.Signals {
		if s.Tier == ReliabilityMedium {
			b.WriteString(fmt.Sprintf("- [%s] %s — %s\n", s.Source, s.Signal, s.Value))
		}
	}

	b.WriteString("\n**LOW reliability** (self-reported or easily gameable):\n")
	for _, s := range r.Signals {
		if s.Tier == ReliabilityLow {
			b.WriteString(fmt.Sprintf("- [%s] %s — %s\n", s.Source, s.Signal, s.Value))
		}
	}

	b.WriteString("\n")
	return b.String()
}
