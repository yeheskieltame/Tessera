package analysis

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/yeheskieltame/tessera/internal/data"
)

// DataFreshness tracks when a signal was generated and collected.
type DataFreshness struct {
	Source       string    `json:"source"`
	Signal       string    `json:"signal"`
	MeasuredAt   time.Time `json:"measuredAt"`   // when the data point was actually generated
	CollectedAt  time.Time `json:"collectedAt"`  // when Tessera fetched it
	AgeHours     float64   `json:"ageHours"`     // hours since measurement
	IndexingLag  int       `json:"indexingLag"`   // known lag in hours for this source
	FreshnessTag string    `json:"freshnessTag"`  // "real-time", "recent", "stale", "unknown"
}

// FreshnessReport aggregates freshness data for all signals.
type FreshnessReport struct {
	Signals       []DataFreshness `json:"signals"`
	CollectedAt   time.Time       `json:"collectedAt"`
	OldestSignal  string          `json:"oldestSignal"`
	NewestSignal  string          `json:"newestSignal"`
	OldestAgeH    float64         `json:"oldestAgeHours"`
	NewestAgeH    float64         `json:"newestAgeHours"`
	StaleCount    int             `json:"staleCount"`    // signals older than 48h
	RealtimeCount int             `json:"realtimeCount"` // signals under 1h
}

func freshnessTag(ageHours float64) string {
	switch {
	case ageHours < 0.5:
		return "real-time"
	case ageHours < 24:
		return "recent"
	case ageHours < 168: // 7 days
		return "current"
	case ageHours < 720: // 30 days
		return "aging"
	default:
		return "stale"
	}
}

// BuildFreshnessReport assesses data freshness across all collected signals.
func BuildFreshnessReport(
	history []data.ProjectEpochData,
	chain *data.ChainSignals,
	githubPushedAt string,
	githubUpdatedAt string,
	osoSignals *data.ProjectSignals,
) *FreshnessReport {
	now := time.Now().UTC()
	report := &FreshnessReport{
		CollectedAt: now,
		OldestAgeH:  0,
		NewestAgeH:  math.MaxFloat64,
	}

	addSignal := func(source, signal string, measured time.Time, lagHours int) {
		age := now.Sub(measured).Hours()
		if age < 0 {
			age = 0
		}
		ds := DataFreshness{
			Source:       source,
			Signal:       signal,
			MeasuredAt:   measured,
			CollectedAt:  now,
			AgeHours:     age,
			IndexingLag:  lagHours,
			FreshnessTag: freshnessTag(age),
		}
		report.Signals = append(report.Signals, ds)

		if age > report.OldestAgeH {
			report.OldestAgeH = age
			report.OldestSignal = fmt.Sprintf("[%s] %s", source, signal)
		}
		if age < report.NewestAgeH {
			report.NewestAgeH = age
			report.NewestSignal = fmt.Sprintf("[%s] %s", source, signal)
		}
		if age > 48 {
			report.StaleCount++
		}
		if age < 1 {
			report.RealtimeCount++
		}
	}

	// Blockchain signals: real-time (block-based)
	if chain != nil {
		for _, ca := range chain.Chains {
			if ca.Error == "" && (ca.Balance > 0 || ca.TxCount > 0) {
				// Blockchain data is as of the latest block — essentially real-time
				addSignal("Blockchain/"+ca.Chain, "Balance & tx count", now, 0)
			}
		}
	}

	// Octant: epoch-based, freshness depends on epoch recency
	if len(history) > 0 {
		// Octant epochs are ~90 days. Latest epoch data is relatively fresh.
		lastEpoch := history[len(history)-1]
		// Approximate: current epoch data is fresh, older epochs are historical
		// Epoch 5 was roughly early 2025 based on Octant timeline
		epochAge := float64(90*24) * 0.5 // midpoint of current epoch ~45 days
		if lastEpoch.Epoch > 0 {
			addSignal("Octant Protocol", fmt.Sprintf("Epoch %d funding data", lastEpoch.Epoch),
				now.Add(-time.Duration(epochAge)*time.Hour), 0)
		}
	}

	// GitHub: use pushed_at and updated_at
	if githubPushedAt != "" {
		if t, err := time.Parse(time.RFC3339, githubPushedAt); err == nil {
			addSignal("GitHub", "Last code push", t, 0)
		}
	}
	if githubUpdatedAt != "" {
		if t, err := time.Parse(time.RFC3339, githubUpdatedAt); err == nil {
			addSignal("GitHub", "Repository metadata update", t, 0)
		}
	}

	// OSO: metrics have ~24h indexing lag
	if osoSignals != nil {
		if osoSignals.Code != nil {
			// OSO code metrics are daily snapshots, ~24h lag
			addSignal("OSO", "Code activity metrics (stars, commits, contributors)", now.Add(-24*time.Hour), 24)
		}
		if osoSignals.Onchain != nil {
			addSignal("OSO", "On-chain metrics (txs, gas, users)", now.Add(-24*time.Hour), 24)
		}
		if osoSignals.Funding != nil {
			addSignal("OSO", "Funding metrics", now.Add(-48*time.Hour), 48)
		}
	}

	if report.NewestAgeH == math.MaxFloat64 {
		report.NewestAgeH = 0
	}

	return report
}

// FormatFreshnessReport produces a markdown summary.
func FormatFreshnessReport(r *FreshnessReport) string {
	if r == nil || len(r.Signals) == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString("### Data Freshness Assessment\n\n")
	b.WriteString(fmt.Sprintf("**Collection timestamp:** %s UTC\n", r.CollectedAt.Format("2006-01-02 15:04")))
	b.WriteString(fmt.Sprintf("**Signals:** %d total | %d real-time | %d stale (>48h)\n",
		len(r.Signals), r.RealtimeCount, r.StaleCount))

	if r.NewestSignal != "" {
		b.WriteString(fmt.Sprintf("**Freshest:** %s (%.1fh ago)\n", r.NewestSignal, r.NewestAgeH))
	}
	if r.OldestSignal != "" {
		b.WriteString(fmt.Sprintf("**Oldest:** %s (%.0fh ago)\n", r.OldestSignal, r.OldestAgeH))
	}
	b.WriteString("\n")

	b.WriteString("| Source | Signal | Age | Freshness | Indexing Lag |\n")
	b.WriteString("|--------|--------|-----|-----------|-------------|\n")
	for _, s := range r.Signals {
		ageStr := formatAge(s.AgeHours)
		lagStr := "none"
		if s.IndexingLag > 0 {
			lagStr = fmt.Sprintf("~%dh", s.IndexingLag)
		}
		b.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s |\n",
			s.Source, s.Signal, ageStr, s.FreshnessTag, lagStr))
	}
	b.WriteString("\n")

	return b.String()
}

func formatAge(hours float64) string {
	if hours < 1 {
		return fmt.Sprintf("%.0fm", hours*60)
	}
	if hours < 48 {
		return fmt.Sprintf("%.1fh", hours)
	}
	return fmt.Sprintf("%.0fd", hours/24)
}
