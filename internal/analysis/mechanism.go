package analysis

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

// AllocationInput represents a single donor→project allocation in ETH.
type AllocationInput struct {
	Donor   string
	Project string
	Amount  float64 // in ETH, already converted
}

// MechanismResult holds the output of a funding mechanism simulation.
type MechanismResult struct {
	Name           string
	Description    string
	Projects       []SimulatedProject
	GiniCoeff      float64 // 0=equal, 1=one project gets all
	TopShare       float64 // fraction going to top project
	AboveThreshold int     // projects that meet minimum viable funding
}

// SimulatedProject holds per-project simulation output.
type SimulatedProject struct {
	Address       string
	Allocated     float64
	OriginalAlloc float64
	Change        float64 // percentage change from original
}

// ---------- Mechanism Simulations ----------

// SimulateStandardQF applies standard quadratic funding.
// For each project: match = (sum of sqrt(contribution_i))^2
// The total matching pool is then distributed proportionally.
func SimulateStandardQF(allocations []AllocationInput) MechanismResult {
	// Group allocations by project, tracking per-donor contributions.
	projectDonors := groupByProject(allocations)

	// Compute QF score per project: (sum sqrt(c_i))^2
	scores := make(map[string]float64)
	var totalScore float64
	for proj, donors := range projectDonors {
		var sqrtSum float64
		for _, amount := range donors {
			sqrtSum += math.Sqrt(amount)
		}
		score := sqrtSum * sqrtSum
		scores[proj] = score
		totalScore += score
	}

	// Compute total funding pool (sum of all contributions).
	totalPool := totalFundingPool(allocations)

	// Distribute pool proportionally to QF scores.
	projects := buildSimulatedProjects(scores, totalScore, totalPool, projectDonors)

	result := MechanismResult{
		Name:        "Standard Quadratic Funding",
		Description: "Classic QF: matching = (sum of sqrt(contributions))^2. Favors broad donor bases over large single donors.",
		Projects:    projects,
	}
	fillStats(&result)
	return result
}

// SimulateCappedQF applies quadratic funding with a cap on per-donor influence.
// capPct is the maximum fraction (0-1) any single donor can contribute to a
// project's effective total. E.g., capPct=0.10 means no donor counts for more
// than 10% of a project's received total.
func SimulateCappedQF(allocations []AllocationInput, capPct float64) MechanismResult {
	if capPct <= 0 {
		capPct = 0.10
	}
	if capPct > 1 {
		capPct = 1.0
	}

	projectDonors := groupByProject(allocations)

	// For each project, cap each donor's contribution.
	cappedDonors := make(map[string]map[string]float64)
	for proj, donors := range projectDonors {
		var projectTotal float64
		for _, amt := range donors {
			projectTotal += amt
		}
		cap := projectTotal * capPct

		capped := make(map[string]float64)
		for donor, amt := range donors {
			if amt > cap {
				capped[donor] = cap
			} else {
				capped[donor] = amt
			}
		}
		cappedDonors[proj] = capped
	}

	// QF on capped contributions.
	scores := make(map[string]float64)
	var totalScore float64
	for proj, donors := range cappedDonors {
		var sqrtSum float64
		for _, amount := range donors {
			sqrtSum += math.Sqrt(amount)
		}
		score := sqrtSum * sqrtSum
		scores[proj] = score
		totalScore += score
	}

	totalPool := totalFundingPool(allocations)
	projects := buildSimulatedProjects(scores, totalScore, totalPool, projectDonors)

	result := MechanismResult{
		Name:        fmt.Sprintf("Capped QF (%.0f%% cap)", capPct*100),
		Description: fmt.Sprintf("Quadratic funding where no single donor's contribution counts for more than %.0f%% of a project's total. Reduces whale influence.", capPct*100),
		Projects:    projects,
	}
	fillStats(&result)
	return result
}

// SimulateEqualWeight treats each unique donor as 1 vote regardless of amount.
// Funding is distributed proportionally to unique donor count.
func SimulateEqualWeight(allocations []AllocationInput) MechanismResult {
	projectDonors := groupByProject(allocations)

	scores := make(map[string]float64)
	var totalScore float64
	for proj, donors := range projectDonors {
		count := float64(len(donors))
		scores[proj] = count
		totalScore += count
	}

	totalPool := totalFundingPool(allocations)
	projects := buildSimulatedProjects(scores, totalScore, totalPool, projectDonors)

	result := MechanismResult{
		Name:        "Equal Weight (1-person-1-vote)",
		Description: "Each unique donor counts as exactly 1 vote regardless of donation size. Funding is proportional to unique donor count. Maximally egalitarian.",
		Projects:    projects,
	}
	fillStats(&result)
	return result
}

// SimulateTrustWeightedQF applies quadratic funding with trust scores as multipliers.
// Projects with higher trust (diverse, organic donor bases) receive a boost;
// projects with low trust (whale-dominated, coordinated) get penalized.
// This is a novel mechanism that combines QF's preference aggregation with
// graph-theoretic trust signals to resist both whale domination and sybil attacks.
func SimulateTrustWeightedQF(allocations []AllocationInput, trustScores map[string]float64) MechanismResult {
	projectDonors := groupByProject(allocations)

	// Standard QF scores first
	qfScores := make(map[string]float64)
	for proj, donors := range projectDonors {
		var sqrtSum float64
		for _, amount := range donors {
			sqrtSum += math.Sqrt(amount)
		}
		qfScores[proj] = sqrtSum * sqrtSum
	}

	// Apply trust multiplier: score = qf_score * (0.5 + 0.5 * trust)
	// Trust of 1.0 (perfect) → multiplier 1.0 (no change)
	// Trust of 0.0 (worst) → multiplier 0.5 (halved)
	// This ensures no project is zeroed out, but low-trust projects lose up to 50%
	scores := make(map[string]float64)
	var totalScore float64
	for proj, qf := range qfScores {
		trust := 0.5 // default if no trust score available
		if t, ok := trustScores[proj]; ok {
			trust = t
		}
		multiplier := 0.5 + 0.5*trust
		score := qf * multiplier
		scores[proj] = score
		totalScore += score
	}

	totalPool := totalFundingPool(allocations)
	projects := buildSimulatedProjects(scores, totalScore, totalPool, projectDonors)

	result := MechanismResult{
		Name:        "Trust-Weighted QF",
		Description: "Quadratic funding modulated by trust scores from donor graph analysis. Projects with diverse, organic donor bases receive full matching; whale-dominated or coordinated projects are penalized up to 50%. Combines QF preference aggregation with sybil resistance.",
		Projects:    projects,
	}
	fillStats(&result)
	return result
}

// ---------- Gini Coefficient ----------

// ComputeGini calculates the Gini coefficient for a set of values.
// Returns 0 for perfect equality, approaches 1 for maximum inequality.
func ComputeGini(values []float64) float64 {
	n := len(values)
	if n == 0 {
		return 0
	}

	sorted := make([]float64, n)
	copy(sorted, values)
	sort.Float64s(sorted)

	var sum float64
	for _, v := range sorted {
		sum += v
	}
	if sum == 0 {
		return 0
	}

	var numerator float64
	for i := 0; i < n; i++ {
		for j := 0; j < n; j++ {
			numerator += math.Abs(sorted[i] - sorted[j])
		}
	}

	return numerator / (2 * float64(n) * sum)
}

// ---------- Distribution Comparison ----------

// CompareDistributions produces a formatted markdown comparison table of mechanisms.
func CompareDistributions(original MechanismResult, alternatives []MechanismResult) string {
	all := append([]MechanismResult{original}, alternatives...)

	var sb strings.Builder
	sb.WriteString("## Funding Mechanism Comparison\n\n")

	// Summary table
	sb.WriteString("| Mechanism | Gini | Top Project Share | Above Threshold | Projects |\n")
	sb.WriteString("|-----------|------|-------------------|-----------------|----------|\n")
	for _, m := range all {
		sb.WriteString(fmt.Sprintf("| %s | %.3f | %.1f%% | %d | %d |\n",
			m.Name, m.GiniCoeff, m.TopShare*100, m.AboveThreshold, len(m.Projects)))
	}

	sb.WriteString("\n")

	// Per-project change table (show top 10 by absolute change in any alternative)
	if len(original.Projects) > 0 && len(alternatives) > 0 {
		sb.WriteString("### Per-Project Distribution Changes (vs Original)\n\n")

		// Header
		sb.WriteString("| Project | Original ETH |")
		for _, alt := range alternatives {
			sb.WriteString(fmt.Sprintf(" %s ETH | Change |", alt.Name))
		}
		sb.WriteString("\n")

		sb.WriteString("|---------|-------------|")
		for range alternatives {
			sb.WriteString("------------|--------|")
		}
		sb.WriteString("\n")

		// Build original lookup
		origMap := make(map[string]float64)
		for _, p := range original.Projects {
			origMap[p.Address] = p.Allocated
		}

		// Collect all addresses from original
		type projectRow struct {
			addr     string
			origETH  float64
			maxDelta float64
		}
		var rows []projectRow
		for _, p := range original.Projects {
			maxDelta := 0.0
			for _, alt := range alternatives {
				for _, ap := range alt.Projects {
					if ap.Address == p.Address {
						d := math.Abs(ap.Change)
						if d > maxDelta {
							maxDelta = d
						}
					}
				}
			}
			rows = append(rows, projectRow{p.Address, p.Allocated, maxDelta})
		}

		// Sort by biggest impact
		sort.Slice(rows, func(i, j int) bool { return rows[i].maxDelta > rows[j].maxDelta })

		limit := 10
		if len(rows) < limit {
			limit = len(rows)
		}

		for i := 0; i < limit; i++ {
			r := rows[i]
			short := shortAddr(r.addr)
			sb.WriteString(fmt.Sprintf("| %s | %.4f |", short, r.origETH))

			for _, alt := range alternatives {
				found := false
				for _, ap := range alt.Projects {
					if ap.Address == r.addr {
						sign := "+"
						if ap.Change < 0 {
							sign = ""
						}
						sb.WriteString(fmt.Sprintf(" %.4f | %s%.1f%% |", ap.Allocated, sign, ap.Change))
						found = true
						break
					}
				}
				if !found {
					sb.WriteString(" 0.0000 | N/A |")
				}
			}
			sb.WriteString("\n")
		}
	}

	sb.WriteString("\n### Key Takeaways\n\n")
	sb.WriteString(fmt.Sprintf("- **Original (%s):** Gini=%.3f, top project gets %.1f%%\n",
		original.Name, original.GiniCoeff, original.TopShare*100))
	for _, alt := range alternatives {
		giniDelta := alt.GiniCoeff - original.GiniCoeff
		direction := "more equal"
		if giniDelta > 0 {
			direction = "less equal"
		}
		sb.WriteString(fmt.Sprintf("- **%s:** Gini=%.3f (%+.3f, %s), top project gets %.1f%%\n",
			alt.Name, alt.GiniCoeff, giniDelta, direction, alt.TopShare*100))
	}

	return sb.String()
}

// ---------- Internal helpers ----------

// groupByProject returns map[projectAddr]map[donorAddr]totalAmount
func groupByProject(allocations []AllocationInput) map[string]map[string]float64 {
	result := make(map[string]map[string]float64)
	for _, a := range allocations {
		if result[a.Project] == nil {
			result[a.Project] = make(map[string]float64)
		}
		result[a.Project][a.Donor] += a.Amount
	}
	return result
}

func totalFundingPool(allocations []AllocationInput) float64 {
	var total float64
	for _, a := range allocations {
		total += a.Amount
	}
	return total
}

// buildSimulatedProjects distributes totalPool according to scores and computes
// original allocations from donor data for the Change field.
func buildSimulatedProjects(scores map[string]float64, totalScore, totalPool float64, projectDonors map[string]map[string]float64) []SimulatedProject {
	var projects []SimulatedProject

	// Compute original (direct sum) per project for comparison.
	origTotals := make(map[string]float64)
	for proj, donors := range projectDonors {
		for _, amt := range donors {
			origTotals[proj] += amt
		}
	}

	for proj, score := range scores {
		var allocated float64
		if totalScore > 0 {
			allocated = (score / totalScore) * totalPool
		}
		orig := origTotals[proj]
		change := 0.0
		if orig > 0 {
			change = ((allocated - orig) / orig) * 100
		}
		projects = append(projects, SimulatedProject{
			Address:       proj,
			Allocated:     allocated,
			OriginalAlloc: orig,
			Change:        change,
		})
	}

	// Sort by allocated descending for consistency.
	sort.Slice(projects, func(i, j int) bool {
		return projects[i].Allocated > projects[j].Allocated
	})

	return projects
}

// fillStats computes GiniCoeff, TopShare, and AboveThreshold for a result.
func fillStats(r *MechanismResult) {
	if len(r.Projects) == 0 {
		return
	}

	values := make([]float64, len(r.Projects))
	var totalAlloc float64
	for i, p := range r.Projects {
		values[i] = p.Allocated
		totalAlloc += p.Allocated
	}

	r.GiniCoeff = ComputeGini(values)

	if totalAlloc > 0 {
		// Projects are sorted descending by allocated.
		r.TopShare = r.Projects[0].Allocated / totalAlloc
	}

	// AboveThreshold: projects receiving at least 1% of pool (minimum viable).
	threshold := totalAlloc * 0.01
	for _, p := range r.Projects {
		if p.Allocated >= threshold {
			r.AboveThreshold++
		}
	}
}

func shortAddr(addr string) string {
	if len(addr) > 10 {
		return addr[:6] + "..." + addr[len(addr)-4:]
	}
	return addr
}
