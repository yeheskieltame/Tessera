package analysis

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

// DonorBehavior holds behavioral analysis for a single donor.
type DonorBehavior struct {
	Address          string  `json:"address"`
	ProjectsFunded   int     `json:"projectsFunded"`   // how many projects this donor funds
	TotalDonated     float64 `json:"totalDonated"`      // total ETH donated across all projects
	AvgDonation      float64 `json:"avgDonation"`       // average per-project donation
	MaxDonation      float64 `json:"maxDonation"`       // largest single donation
	ConcentrationPct float64 `json:"concentrationPct"`  // % of total going to top project
	IsRepeat         bool    `json:"isRepeat"`          // funded in previous epoch too
	BehaviorTag      string  `json:"behaviorTag"`       // "diversified", "focused", "whale", "micro", "sybil-risk"
}

// DonorProfileReport aggregates donor behavior analysis for the epoch.
type DonorProfileReport struct {
	TotalDonors        int              `json:"totalDonors"`
	Profiles           []DonorBehavior  `json:"profiles"` // top donors by total donated
	DiversifiedCount   int              `json:"diversifiedCount"`   // donors funding 3+ projects
	FocusedCount       int              `json:"focusedCount"`       // donors funding 1-2 projects
	WhaleCount         int              `json:"whaleCount"`         // donors with >10% of epoch total
	MicroDonorCount    int              `json:"microDonorCount"`    // donors with <0.01 ETH total
	SybilRiskCount     int              `json:"sybilRiskCount"`     // donors matching sybil patterns
	RepeatDonorPct     float64          `json:"repeatDonorPct"`     // % of donors who are repeat
	AvgProjectsPerDonor float64         `json:"avgProjectsPerDonor"`
	MedianDonation     float64          `json:"medianDonation"`
	// Concentration metrics
	Top10DonorShare    float64          `json:"top10DonorShare"`    // % of total funded by top 10 donors
	Top1DonorShare     float64          `json:"top1DonorShare"`     // % of total funded by #1 donor
}

// BuildDonorProfiles analyzes individual donor behavior patterns.
func BuildDonorProfiles(
	projects []string,
	amounts []float64,
	donors []string,
	previousDonors map[string]bool,
) *DonorProfileReport {
	if len(donors) == 0 {
		return &DonorProfileReport{}
	}

	// Group allocations by donor
	type donorData struct {
		projects map[string]float64 // project → amount
		total    float64
	}
	donorMap := map[string]*donorData{}

	for i := range donors {
		d := strings.ToLower(donors[i])
		if _, ok := donorMap[d]; !ok {
			donorMap[d] = &donorData{projects: map[string]float64{}}
		}
		donorMap[d].projects[strings.ToLower(projects[i])] += amounts[i]
		donorMap[d].total += amounts[i]
	}

	// Compute epoch total
	epochTotal := 0.0
	for _, dd := range donorMap {
		epochTotal += dd.total
	}

	// Build profiles
	var profiles []DonorBehavior
	var allDonations []float64
	totalProjectsFunded := 0

	for addr, dd := range donorMap {
		// Find max single project donation
		maxDon := 0.0
		for _, amt := range dd.projects {
			if amt > maxDon {
				maxDon = amt
			}
			allDonations = append(allDonations, amt)
		}

		concentration := 0.0
		if dd.total > 0 {
			concentration = (maxDon / dd.total) * 100
		}

		isRepeat := false
		if previousDonors != nil {
			isRepeat = previousDonors[addr]
		}

		nProjects := len(dd.projects)
		totalProjectsFunded += nProjects

		avg := 0.0
		if nProjects > 0 {
			avg = dd.total / float64(nProjects)
		}

		// Classify behavior
		tag := classifyDonor(nProjects, dd.total, concentration, epochTotal, isRepeat)

		profiles = append(profiles, DonorBehavior{
			Address:          addr,
			ProjectsFunded:   nProjects,
			TotalDonated:     dd.total,
			AvgDonation:      avg,
			MaxDonation:      maxDon,
			ConcentrationPct: concentration,
			IsRepeat:         isRepeat,
			BehaviorTag:      tag,
		})
	}

	// Sort by total donated (descending)
	sort.Slice(profiles, func(i, j int) bool {
		return profiles[i].TotalDonated > profiles[j].TotalDonated
	})

	// Compute report stats
	report := &DonorProfileReport{
		TotalDonors: len(profiles),
		AvgProjectsPerDonor: float64(totalProjectsFunded) / float64(len(profiles)),
	}

	// Median donation
	sort.Float64s(allDonations)
	if len(allDonations) > 0 {
		mid := len(allDonations) / 2
		if len(allDonations)%2 == 0 {
			report.MedianDonation = (allDonations[mid-1] + allDonations[mid]) / 2
		} else {
			report.MedianDonation = allDonations[mid]
		}
	}

	// Counts and shares
	repeatCount := 0
	for _, p := range profiles {
		switch p.BehaviorTag {
		case "diversified":
			report.DiversifiedCount++
		case "focused":
			report.FocusedCount++
		case "whale":
			report.WhaleCount++
		case "micro":
			report.MicroDonorCount++
		case "sybil-risk":
			report.SybilRiskCount++
		}
		if p.IsRepeat {
			repeatCount++
		}
	}
	if len(profiles) > 0 {
		report.RepeatDonorPct = float64(repeatCount) / float64(len(profiles)) * 100
	}

	// Top donor shares
	if epochTotal > 0 && len(profiles) > 0 {
		report.Top1DonorShare = (profiles[0].TotalDonated / epochTotal) * 100

		top10Total := 0.0
		top10Count := int(math.Min(10, float64(len(profiles))))
		for i := 0; i < top10Count; i++ {
			top10Total += profiles[i].TotalDonated
		}
		report.Top10DonorShare = (top10Total / epochTotal) * 100
	}

	// Keep top 20 profiles for the report
	if len(profiles) > 20 {
		report.Profiles = profiles[:20]
	} else {
		report.Profiles = profiles
	}

	return report
}

func classifyDonor(nProjects int, total, concentrationPct, epochTotal float64, isRepeat bool) string {
	epochShare := 0.0
	if epochTotal > 0 {
		epochShare = total / epochTotal
	}

	// Whale: >10% of epoch total
	if epochShare > 0.10 {
		return "whale"
	}

	// Micro: <0.01 ETH total
	if total < 0.01 {
		return "micro"
	}

	// Sybil-risk: funds exactly 1 project, small amount, not a repeat donor
	if nProjects == 1 && total < 0.1 && !isRepeat {
		return "sybil-risk"
	}

	// Diversified: funds 3+ projects
	if nProjects >= 3 {
		return "diversified"
	}

	// Focused: funds 1-2 projects
	return "focused"
}

// FormatDonorProfileReport produces markdown output.
func FormatDonorProfileReport(r *DonorProfileReport) string {
	if r == nil || r.TotalDonors == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString("### Donor Behavior Profiling\n\n")
	b.WriteString(fmt.Sprintf("**Total donors:** %d | **Avg projects/donor:** %.1f | **Median donation:** %.4f ETH\n",
		r.TotalDonors, r.AvgProjectsPerDonor, r.MedianDonation))
	b.WriteString(fmt.Sprintf("**Repeat donors:** %.1f%% | **Top 1 donor share:** %.1f%% | **Top 10 donor share:** %.1f%%\n\n",
		r.RepeatDonorPct, r.Top1DonorShare, r.Top10DonorShare))

	b.WriteString("**Behavior Classification:**\n")
	b.WriteString(fmt.Sprintf("- Diversified (3+ projects): %d donors\n", r.DiversifiedCount))
	b.WriteString(fmt.Sprintf("- Focused (1-2 projects): %d donors\n", r.FocusedCount))
	b.WriteString(fmt.Sprintf("- Whales (>10%% of epoch): %d donors\n", r.WhaleCount))
	b.WriteString(fmt.Sprintf("- Micro (<0.01 ETH): %d donors\n", r.MicroDonorCount))
	b.WriteString(fmt.Sprintf("- Sybil-risk (1 project, small, new): %d donors\n\n", r.SybilRiskCount))

	if len(r.Profiles) > 0 {
		b.WriteString("**Top donors by volume:**\n")
		b.WriteString("| # | Address | Projects | Total ETH | Top Project % | Tag |\n")
		b.WriteString("|---|---------|----------|-----------|---------------|-----|\n")
		limit := 10
		if len(r.Profiles) < limit {
			limit = len(r.Profiles)
		}
		for i := 0; i < limit; i++ {
			p := r.Profiles[i]
			shortAddr := p.Address
			if len(shortAddr) > 14 {
				shortAddr = shortAddr[:8] + "..." + shortAddr[len(shortAddr)-4:]
			}
			b.WriteString(fmt.Sprintf("| %d | %s | %d | %.4f | %.0f%% | %s |\n",
				i+1, shortAddr, p.ProjectsFunded, p.TotalDonated, p.ConcentrationPct, p.BehaviorTag))
		}
		b.WriteString("\n")
	}

	return b.String()
}
