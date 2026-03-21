package analysis

import (
	"fmt"
	"math"
	"strings"

	"github.com/yeheskieltame/tessera/internal/data"
)

// CorroborationVerdict classifies how well signals agree.
type CorroborationVerdict string

const (
	VerdictConfirmed    CorroborationVerdict = "CONFIRMED"    // sources agree
	VerdictConflicting  CorroborationVerdict = "CONFLICTING"  // sources disagree significantly
	VerdictPartial      CorroborationVerdict = "PARTIAL"      // partial agreement
	VerdictUnverifiable CorroborationVerdict = "UNVERIFIABLE" // only one source available
)

// CorroborationCheck represents one cross-verification between sources.
type CorroborationCheck struct {
	Claim       string               `json:"claim"`
	SourceA     string               `json:"sourceA"`
	ValueA      string               `json:"valueA"`
	SourceB     string               `json:"sourceB"`
	ValueB      string               `json:"valueB"`
	Verdict     CorroborationVerdict `json:"verdict"`
	Explanation string               `json:"explanation"`
	Severity    string               `json:"severity"` // "high", "medium", "low"
}

// CorroborationReport aggregates all cross-verification checks.
type CorroborationReport struct {
	Checks         []CorroborationCheck `json:"checks"`
	ConfirmedCount int                  `json:"confirmedCount"`
	ConflictCount  int                  `json:"conflictCount"`
	PartialCount   int                  `json:"partialCount"`
	TrustScore     float64              `json:"trustScore"` // 0-100, weighted by severity
}

// CrossVerifySignals compares signals across multiple independent sources.
func CrossVerifySignals(
	trust *TrustProfile,
	chain *data.ChainSignals,
	osoSignals *data.ProjectSignals,
	githubSignals *data.GitHubSignals,
	history []data.ProjectEpochData,
) *CorroborationReport {
	report := &CorroborationReport{}

	// Check 1: OSO contributors vs GitHub contributors
	if osoSignals != nil && osoSignals.Code != nil && githubSignals != nil && githubSignals.Repo != nil {
		osoContribs := osoSignals.Code.ContributorCount
		ghContribs := float64(len(githubSignals.Contributors))
		if ghContribs == 0 && githubSignals.Repo != nil {
			ghContribs = 1 // at minimum the repo exists
		}

		ratio := 1.0
		if ghContribs > 0 {
			ratio = osoContribs / ghContribs
		}

		verdict := VerdictConfirmed
		explanation := fmt.Sprintf("OSO reports %.0f contributors, GitHub shows %.0f (ratio: %.2f)", osoContribs, ghContribs, ratio)
		severity := "low"

		if ratio > 2.0 || ratio < 0.5 {
			verdict = VerdictConflicting
			explanation += " — significant discrepancy, may indicate different counting methods or data staleness"
			severity = "medium"
		} else if ratio > 1.3 || ratio < 0.7 {
			verdict = VerdictPartial
			explanation += " — minor discrepancy, likely different time windows"
		}

		report.Checks = append(report.Checks, CorroborationCheck{
			Claim:       "Contributor count",
			SourceA:     "OSO (Open Source Observer)",
			ValueA:      fmt.Sprintf("%.0f contributors", osoContribs),
			SourceB:     "GitHub API (top 30)",
			ValueB:      fmt.Sprintf("%.0f contributors", ghContribs),
			Verdict:     verdict,
			Explanation: explanation,
			Severity:    severity,
		})
	}

	// Check 2: OSO stars vs GitHub stars
	if osoSignals != nil && osoSignals.Code != nil && githubSignals != nil && githubSignals.Repo != nil {
		osoStars := osoSignals.Code.StarCount
		ghStars := float64(githubSignals.Repo.Stars)

		verdict := VerdictConfirmed
		explanation := fmt.Sprintf("OSO: %.0f stars, GitHub: %.0f stars", osoStars, ghStars)
		severity := "low"

		diff := math.Abs(osoStars - ghStars)
		maxStars := math.Max(osoStars, ghStars)
		if maxStars > 0 && diff/maxStars > 0.2 {
			verdict = VerdictPartial
			explanation += " — difference suggests OSO data may be stale (24h+ indexing lag)"
			severity = "low"
		}
		if maxStars > 0 && diff/maxStars > 0.5 {
			verdict = VerdictConflicting
			explanation += " — major discrepancy, investigate data freshness"
			severity = "medium"
		}

		report.Checks = append(report.Checks, CorroborationCheck{
			Claim:       "Repository star count",
			SourceA:     "OSO (Open Source Observer)",
			ValueA:      fmt.Sprintf("%.0f stars", osoStars),
			SourceB:     "GitHub API (real-time)",
			ValueB:      fmt.Sprintf("%d stars", githubSignals.Repo.Stars),
			Verdict:     verdict,
			Explanation: explanation,
			Severity:    severity,
		})
	}

	// Check 3: On-chain activity (OSO) vs blockchain scan
	if osoSignals != nil && osoSignals.Onchain != nil && chain != nil {
		osoTxs := osoSignals.Onchain.TransactionCount6Months
		chainTxs := float64(chain.TotalTxCount)

		verdict := VerdictConfirmed
		explanation := fmt.Sprintf("OSO (6mo): %.0f txs, Blockchain scan (all-time): %d txs", osoTxs, chain.TotalTxCount)
		severity := "medium"

		// Chain scan is nonce (all-time), OSO is 6mo — so chain >= OSO is expected
		if chainTxs > 0 && osoTxs > chainTxs*1.5 {
			verdict = VerdictConflicting
			explanation += " — OSO reports more 6mo transactions than all-time nonce count, data integrity issue"
			severity = "high"
		} else if chainTxs == 0 && osoTxs > 0 {
			verdict = VerdictConflicting
			explanation += " — OSO shows activity but blockchain scan shows zero txs, possible different addresses"
			severity = "high"
		} else if chainTxs > 0 && osoTxs == 0 {
			verdict = VerdictPartial
			explanation += " — blockchain shows activity but OSO has no data, project may not be indexed"
		}

		report.Checks = append(report.Checks, CorroborationCheck{
			Claim:       "On-chain transaction activity",
			SourceA:     "OSO (6mo aggregate)",
			ValueA:      fmt.Sprintf("%.0f transactions", osoTxs),
			SourceB:     "Blockchain RPC (nonce/all-time)",
			ValueB:      fmt.Sprintf("%d transactions across %d chains", chain.TotalTxCount, chain.TotalChainsActive),
			Verdict:     verdict,
			Explanation: explanation,
			Severity:    severity,
		})
	}

	// Check 4: Funding consistency (Octant allocated vs matched ratio)
	if len(history) > 0 {
		var totalAlloc, totalMatched float64
		for _, h := range history {
			totalAlloc += h.Allocated
			totalMatched += h.Matched
		}

		if totalAlloc > 0 {
			matchRatio := totalMatched / totalAlloc
			verdict := VerdictConfirmed
			explanation := fmt.Sprintf("Total allocated: %.4f ETH, matched: %.4f ETH, match ratio: %.2fx", totalAlloc, totalMatched, matchRatio)
			severity := "medium"

			if matchRatio > 10 {
				verdict = VerdictPartial
				explanation += " — extremely high match ratio suggests small donor count with large matching pool amplification"
				severity = "medium"
			}

			report.Checks = append(report.Checks, CorroborationCheck{
				Claim:       "Funding match ratio consistency",
				SourceA:     "Octant (allocated by donors)",
				ValueA:      fmt.Sprintf("%.4f ETH direct", totalAlloc),
				SourceB:     "Octant (protocol matching)",
				ValueB:      fmt.Sprintf("%.4f ETH matched (%.2fx)", totalMatched, matchRatio),
				Verdict:     verdict,
				Explanation: explanation,
				Severity:    severity,
			})
		}
	}

	// Check 5: Donor diversity vs whale dependency (internal consistency)
	if trust != nil {
		verdict := VerdictConfirmed
		explanation := fmt.Sprintf("Diversity: %.3f, Whale dep: %.1f%%", trust.DonorDiversity, trust.WhaleDepRatio*100)
		severity := "low"

		// High diversity + high whale dep = internal contradiction
		if trust.DonorDiversity > 0.7 && trust.WhaleDepRatio > 0.5 {
			verdict = VerdictConflicting
			explanation += " — high diversity score but high whale dependency is mathematically unusual, check donor count"
			severity = "high"
		}
		// Low diversity + low whale dep = unusual but possible (many small equal donors)
		if trust.DonorDiversity < 0.3 && trust.WhaleDepRatio < 0.2 {
			verdict = VerdictPartial
			explanation += " — low diversity but low whale ratio suggests few donors contributing equal amounts"
		}

		report.Checks = append(report.Checks, CorroborationCheck{
			Claim:       "Donor diversity vs whale dependency consistency",
			SourceA:     "Trust Graph (Shannon entropy)",
			ValueA:      fmt.Sprintf("%.3f diversity", trust.DonorDiversity),
			SourceB:     "Trust Graph (whale ratio)",
			ValueB:      fmt.Sprintf("%.1f%% whale dependency", trust.WhaleDepRatio*100),
			Verdict:     verdict,
			Explanation: explanation,
			Severity:    severity,
		})
	}

	// Check 6: OSO funding vs Octant funding cross-reference
	if osoSignals != nil && osoSignals.Funding != nil && len(history) > 0 {
		osoFunding := osoSignals.Funding.TotalFundingReceivedUSD
		var totalOctantETH float64
		for _, h := range history {
			totalOctantETH += h.Allocated + h.Matched
		}
		// Rough ETH→USD at ~$2000 for comparison
		octantUSD := totalOctantETH * 2000

		verdict := VerdictConfirmed
		explanation := fmt.Sprintf("OSO reports $%.0f (6mo, cross-platform), Octant ~$%.0f (at $2000/ETH est.)", osoFunding, octantUSD)
		severity := "medium"

		if osoFunding > 0 && octantUSD > 0 {
			if osoFunding > octantUSD*3 {
				verdict = VerdictPartial
				explanation += " — OSO shows more funding than Octant alone, consistent with multi-platform funding"
			}
			if octantUSD > osoFunding*2 && osoFunding > 0 {
				verdict = VerdictConflicting
				explanation += " — Octant funding exceeds OSO's cross-platform total, possible indexing gap"
				severity = "high"
			}
		}

		report.Checks = append(report.Checks, CorroborationCheck{
			Claim:       "Cross-platform funding totals",
			SourceA:     "OSO (cross-platform, 6mo)",
			ValueA:      fmt.Sprintf("$%.0f USD", osoFunding),
			SourceB:     "Octant Protocol (all epochs, estimated USD)",
			ValueB:      fmt.Sprintf("$%.0f USD (~%.4f ETH at $2000)", octantUSD, totalOctantETH),
			Verdict:     verdict,
			Explanation: explanation,
			Severity:    severity,
		})
	}

	// Check 7: GitHub activity vs code deployment (has contracts?)
	if githubSignals != nil && githubSignals.Repo != nil && chain != nil {
		hasCode := !githubSignals.Repo.Archived && githubSignals.Repo.Size > 0
		hasContracts := chain.HasContracts

		verdict := VerdictUnverifiable
		explanation := "Checking if GitHub code activity aligns with on-chain deployment"
		severity := "low"

		if hasCode && hasContracts {
			verdict = VerdictConfirmed
			explanation = fmt.Sprintf("Active GitHub repo (%s, %d KB) with deployed contracts — code-to-chain consistency confirmed",
				githubSignals.Repo.Language, githubSignals.Repo.Size)
		} else if hasCode && !hasContracts && chain.TotalChainsActive > 0 {
			verdict = VerdictPartial
			explanation = "Active code repo but no deployed contracts — project may be off-chain or contracts under different address"
		} else if !hasCode && hasContracts {
			verdict = VerdictConflicting
			explanation = "Deployed contracts but archived/empty GitHub repo — possible abandoned project with live contracts"
			severity = "high"
		}

		report.Checks = append(report.Checks, CorroborationCheck{
			Claim:       "Code activity vs on-chain deployment",
			SourceA:     "GitHub",
			ValueA:      fmt.Sprintf("Active: %v, Language: %s, Size: %d KB", hasCode, githubSignals.Repo.Language, githubSignals.Repo.Size),
			SourceB:     "Blockchain Scan",
			ValueB:      fmt.Sprintf("Contracts: %v, Active chains: %d", hasContracts, chain.TotalChainsActive),
			Verdict:     verdict,
			Explanation: explanation,
			Severity:    severity,
		})
	}

	// Compute summary
	for _, c := range report.Checks {
		switch c.Verdict {
		case VerdictConfirmed:
			report.ConfirmedCount++
		case VerdictConflicting:
			report.ConflictCount++
		case VerdictPartial:
			report.PartialCount++
		}
	}

	// Trust score: weighted by severity
	if len(report.Checks) > 0 {
		totalWeight := 0.0
		score := 0.0
		for _, c := range report.Checks {
			w := 1.0
			switch c.Severity {
			case "high":
				w = 3.0
			case "medium":
				w = 2.0
			}
			totalWeight += w
			switch c.Verdict {
			case VerdictConfirmed:
				score += w * 1.0
			case VerdictPartial:
				score += w * 0.6
			case VerdictUnverifiable:
				score += w * 0.5
			case VerdictConflicting:
				score += w * 0.0
			}
		}
		report.TrustScore = (score / totalWeight) * 100
	}

	return report
}

// FormatCorroborationReport produces markdown output.
func FormatCorroborationReport(r *CorroborationReport) string {
	if r == nil || len(r.Checks) == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString("### Signal Corroboration (Cross-Verification)\n\n")
	b.WriteString(fmt.Sprintf("**Trust Score:** %.0f/100 | **Checks:** %d total | %d confirmed | %d conflicting | %d partial\n\n",
		r.TrustScore, len(r.Checks), r.ConfirmedCount, r.ConflictCount, r.PartialCount))

	for i, c := range r.Checks {
		icon := "?"
		switch c.Verdict {
		case VerdictConfirmed:
			icon = "OK"
		case VerdictConflicting:
			icon = "!!"
		case VerdictPartial:
			icon = "~"
		}
		b.WriteString(fmt.Sprintf("**%d. %s** [%s] (%s severity)\n", i+1, c.Claim, icon, c.Severity))
		b.WriteString(fmt.Sprintf("- %s: %s\n", c.SourceA, c.ValueA))
		b.WriteString(fmt.Sprintf("- %s: %s\n", c.SourceB, c.ValueB))
		b.WriteString(fmt.Sprintf("- **Verdict:** %s — %s\n\n", c.Verdict, c.Explanation))
	}

	return b.String()
}
