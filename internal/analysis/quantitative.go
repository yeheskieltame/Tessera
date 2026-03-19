package analysis

import (
	"fmt"
	"math"
	"math/big"
	"sort"
)

// ProjectMetrics holds normalized numeric data for a project.
type ProjectMetrics struct {
	Address        string
	Allocated      float64
	Matched        float64
	TotalFunding   float64
	DonorCount     int
	CompositeScore float64
	Cluster        int
}

// WeiToEth converts a wei string to ETH float64.
func WeiToEth(wei string) float64 {
	n := new(big.Int)
	n.SetString(wei, 10)
	f := new(big.Float).SetInt(n)
	eth, _ := new(big.Float).Quo(f, big.NewFloat(1e18)).Float64()
	return eth
}

// ComputeCompositeScores normalizes and scores a slice of ProjectMetrics.
// Score = weighted average of normalized allocated + matched, scaled 0–100.
func ComputeCompositeScores(projects []ProjectMetrics) []ProjectMetrics {
	if len(projects) == 0 {
		return projects
	}

	minAlloc, maxAlloc := minMax(projects, func(p ProjectMetrics) float64 { return p.Allocated })
	minMatch, maxMatch := minMax(projects, func(p ProjectMetrics) float64 { return p.Matched })

	for i := range projects {
		normAlloc := normalize(projects[i].Allocated, minAlloc, maxAlloc)
		normMatch := normalize(projects[i].Matched, minMatch, maxMatch)
		projects[i].CompositeScore = math.Round((normAlloc*0.4+normMatch*0.6)*10000) / 100 // 0–100
	}
	return projects
}

// SimpleKMeans assigns each project to one of k clusters based on (Allocated, Matched).
// Uses Lloyd's algorithm.
func SimpleKMeans(projects []ProjectMetrics, k int) []ProjectMetrics {
	n := len(projects)
	if n == 0 || k <= 0 {
		return projects
	}
	if k > n {
		k = n
	}

	type point struct{ x, y float64 }
	points := make([]point, n)
	// Normalize for clustering
	minA, maxA := minMax(projects, func(p ProjectMetrics) float64 { return p.Allocated })
	minM, maxM := minMax(projects, func(p ProjectMetrics) float64 { return p.Matched })
	for i, p := range projects {
		points[i] = point{normalize(p.Allocated, minA, maxA), normalize(p.Matched, minM, maxM)}
	}

	// Init centroids by picking evenly spaced projects sorted by total
	sort.Slice(projects, func(i, j int) bool { return projects[i].TotalFunding > projects[j].TotalFunding })
	centroids := make([]point, k)
	for i := 0; i < k; i++ {
		idx := i * n / k
		centroids[i] = points[idx]
	}

	assignments := make([]int, n)
	for iter := 0; iter < 50; iter++ {
		changed := false
		// Assign
		for i, p := range points {
			best := 0
			bestDist := math.MaxFloat64
			for c, cent := range centroids {
				d := (p.x-cent.x)*(p.x-cent.x) + (p.y-cent.y)*(p.y-cent.y)
				if d < bestDist {
					bestDist = d
					best = c
				}
			}
			if assignments[i] != best {
				assignments[i] = best
				changed = true
			}
		}
		if !changed {
			break
		}
		// Update centroids
		for c := range centroids {
			var sx, sy float64
			var cnt int
			for i, a := range assignments {
				if a == c {
					sx += points[i].x
					sy += points[i].y
					cnt++
				}
			}
			if cnt > 0 {
				centroids[c] = point{sx / float64(cnt), sy / float64(cnt)}
			}
		}
	}

	for i := range projects {
		projects[i].Cluster = assignments[i]
	}
	return projects
}

// AnomalyReport summarizes funding anomaly detection.
type AnomalyReport struct {
	TotalDonations     int
	UniqueDonors       int
	TotalAmount        float64
	MeanDonation       float64
	MedianDonation     float64
	MaxDonation        float64
	WhaleConcentration float64
	Flags              []string
}

// DetectAnomalies analyzes donation patterns for suspicious activity.
func DetectAnomalies(donors []string, amounts []float64) *AnomalyReport {
	r := &AnomalyReport{
		TotalDonations: len(amounts),
	}
	if len(amounts) == 0 {
		return r
	}

	// Unique donors
	seen := map[string]bool{}
	for _, d := range donors {
		seen[d] = true
	}
	r.UniqueDonors = len(seen)

	// Stats
	sorted := make([]float64, len(amounts))
	copy(sorted, amounts)
	sort.Float64s(sorted)

	var sum float64
	for _, a := range sorted {
		sum += a
	}
	r.TotalAmount = sum
	r.MeanDonation = sum / float64(len(sorted))
	r.MaxDonation = sorted[len(sorted)-1]

	mid := len(sorted) / 2
	if len(sorted)%2 == 0 {
		r.MedianDonation = (sorted[mid-1] + sorted[mid]) / 2
	} else {
		r.MedianDonation = sorted[mid]
	}

	// Whale concentration: top 10% donors' share
	donorTotals := map[string]float64{}
	for i, d := range donors {
		if i < len(amounts) {
			donorTotals[d] += amounts[i]
		}
	}
	if len(donorTotals) > 10 {
		totals := make([]float64, 0, len(donorTotals))
		for _, v := range donorTotals {
			totals = append(totals, v)
		}
		sort.Float64s(totals)
		top10pct := max(1, len(totals)/10)
		var topSum float64
		for i := len(totals) - top10pct; i < len(totals); i++ {
			topSum += totals[i]
		}
		r.WhaleConcentration = topSum / sum
		if r.WhaleConcentration > 0.5 {
			r.Flags = append(r.Flags, fmt.Sprintf("Top 10%% of donors control %.1f%% of total funding", r.WhaleConcentration*100))
		}
	}

	// Duplicate amount patterns — only flag if >2% of donations share exact amount AND amount > 0.001 ETH
	amountCounts := map[float64]int{}
	for _, a := range amounts {
		if a > 0.001 { // ignore dust amounts
			// Round to 4 decimals to group near-identical amounts
			rounded := math.Round(a*10000) / 10000
			amountCounts[rounded]++
		}
	}
	threshold := max(5, len(amounts)/50) // at least 5, or 2% of total
	for amt, count := range amountCounts {
		if count >= threshold {
			r.Flags = append(r.Flags, fmt.Sprintf("%d donations of exactly %.4f ETH — possible coordination", count, amt))
		}
	}

	return r
}

// --- Cross-Reference Scoring ---

// CrossRefSignal represents a cross-referenced signal between funding and activity data.
type CrossRefSignal struct {
	Address        string
	FundingETH     float64
	DonorCount     int
	GitHubActive   bool    // has recent commits/PRs
	CommitCount    float64 // 6 months
	Contributors   float64
	OnchainTxCount float64 // 6 months
	OnchainUsers   float64 // 90 days
	Signal         string  // "healthy", "overfunded", "underfunded", "inactive", "suspicious"
	Explanation    string
}

// CrossReferenceSignals compares Octant funding data with OSO development/on-chain metrics
// to identify projects that are overfunded relative to activity, underfunded despite high
// activity, or showing suspicious patterns.
func CrossReferenceSignals(
	fundingMetrics []ProjectMetrics,
	codeActivity map[string][2]float64, // address -> [commitCount6m, contributorCount]
	onchainActivity map[string][2]float64, // address -> [txCount6m, userCount90d]
) []CrossRefSignal {
	var signals []CrossRefSignal

	for _, fm := range fundingMetrics {
		sig := CrossRefSignal{
			Address:    fm.Address,
			FundingETH: fm.TotalFunding,
			DonorCount: fm.DonorCount,
		}

		code, hasCode := codeActivity[fm.Address]
		if hasCode {
			sig.CommitCount = code[0]
			sig.Contributors = code[1]
			sig.GitHubActive = code[0] > 10 // at least 10 commits in 6 months
		}

		chain, hasChain := onchainActivity[fm.Address]
		if hasChain {
			sig.OnchainTxCount = chain[0]
			sig.OnchainUsers = chain[1]
		}

		// Classify signal
		highFunding := fm.CompositeScore > 50 // top half by score
		hasActivity := (hasCode && sig.CommitCount > 10) || (hasChain && sig.OnchainTxCount > 100)
		lowActivity := (hasCode && sig.CommitCount < 5) && (!hasChain || sig.OnchainTxCount < 10)

		switch {
		case highFunding && hasActivity:
			sig.Signal = "healthy"
			sig.Explanation = "High funding matched by active development/on-chain usage"
		case highFunding && lowActivity:
			sig.Signal = "overfunded"
			sig.Explanation = "Receives significant funding but shows minimal development or on-chain activity — investigate"
		case !highFunding && hasActivity:
			sig.Signal = "underfunded"
			sig.Explanation = "Active development/usage but receives below-average funding — potential undervalued public good"
		case highFunding && !hasCode && !hasChain:
			sig.Signal = "unverified"
			sig.Explanation = "Significant funding but no OSO data available to verify activity"
		default:
			sig.Signal = "neutral"
			sig.Explanation = "Moderate funding with limited activity data"
		}

		signals = append(signals, sig)
	}

	return signals
}

// --- Multi-Layer Scoring ---

// MultiScore holds 5-dimension scoring for a project.
type MultiScore struct {
	Address          string
	FundingScore     float64 // 0-100: normalized total funding
	EfficiencyScore  float64 // 0-100: matched/allocated ratio (community support amplified by QF)
	DiversityScore   float64 // 0-100: based on donor diversity (Shannon entropy)
	ConsistencyScore float64 // 0-100: stability across epochs (default 50 for single-epoch)
	OverallScore     float64 // 0-100: weighted aggregate
}

// ComputeMultiScores computes a 5-dimension score for each project.
// trustProfiles may be nil or empty; in that case DiversityScore falls back to
// normalized donor count.
// epochHistory is optional: map[address][]epochFunding for consistency scoring.
// If nil, ConsistencyScore defaults to 50.
func ComputeMultiScores(projects []ProjectMetrics, trustProfiles []TrustProfile, epochHistory ...map[string][]float64) []MultiScore {
	if len(projects) == 0 {
		return nil
	}

	// Build trust profile lookup by address.
	tpMap := map[string]TrustProfile{}
	for _, tp := range trustProfiles {
		tpMap[tp.Address] = tp
	}

	// --- FundingScore: normalize totalFunding to 0-100 ---
	minFund, maxFund := minMax(projects, func(p ProjectMetrics) float64 { return p.TotalFunding })

	// --- EfficiencyScore: matched/allocated ratio, capped at 100x ---
	type ratioEntry struct {
		ratio float64
	}
	ratios := make([]float64, len(projects))
	for i, p := range projects {
		if p.Allocated > 0 {
			r := p.Matched / p.Allocated
			if r > 100 {
				r = 100
			}
			ratios[i] = r
		}
	}
	minRatio, maxRatio := ratios[0], ratios[0]
	for _, r := range ratios {
		if r < minRatio {
			minRatio = r
		}
		if r > maxRatio {
			maxRatio = r
		}
	}

	// --- DiversityScore fallback: normalize donor count ---
	minDonors, maxDonors := float64(projects[0].DonorCount), float64(projects[0].DonorCount)
	for _, p := range projects {
		d := float64(p.DonorCount)
		if d < minDonors {
			minDonors = d
		}
		if d > maxDonors {
			maxDonors = d
		}
	}

	scores := make([]MultiScore, len(projects))
	for i, p := range projects {
		ms := MultiScore{Address: p.Address}

		// FundingScore
		ms.FundingScore = math.Round(normalize(p.TotalFunding, minFund, maxFund) * 10000) / 100

		// EfficiencyScore
		ms.EfficiencyScore = math.Round(normalize(ratios[i], minRatio, maxRatio) * 10000) / 100

		// DiversityScore
		if tp, ok := tpMap[p.Address]; ok {
			ms.DiversityScore = math.Round(tp.DonorDiversity * 10000) / 100
		} else {
			// Fallback: normalize donor count
			ms.DiversityScore = math.Round(normalize(float64(p.DonorCount), minDonors, maxDonors) * 10000) / 100
		}

		// ConsistencyScore: computed from cross-epoch funding variance if available
		ms.ConsistencyScore = 50.0 // default neutral
		if len(epochHistory) > 0 && epochHistory[0] != nil {
			if hist, ok := epochHistory[0][p.Address]; ok && len(hist) >= 2 {
				// Consistency = 100 - normalized coefficient of variation
				// Low variance = high consistency
				var sum float64
				for _, v := range hist {
					sum += v
				}
				mean := sum / float64(len(hist))
				if mean > 0 {
					var variance float64
					for _, v := range hist {
						d := v - mean
						variance += d * d
					}
					variance /= float64(len(hist))
					cv := math.Sqrt(variance) / mean // coefficient of variation
					// CV of 0 = perfect consistency (100), CV >= 2 = very inconsistent (0)
					score := (1 - math.Min(cv/2.0, 1.0)) * 100
					ms.ConsistencyScore = math.Round(score*100) / 100
				}
			}
		}

		// OverallScore: 25% funding + 25% efficiency + 30% diversity + 20% consistency
		ms.OverallScore = math.Round((ms.FundingScore*0.25+ms.EfficiencyScore*0.25+ms.DiversityScore*0.30+ms.ConsistencyScore*0.20)*100) / 100

		scores[i] = ms
	}

	return scores
}

// --- Temporal Anomaly Detection ---

// TemporalAnomaly represents a suspicious pattern detected across epochs.
type TemporalAnomaly struct {
	Type        string  // "donor_surge", "funding_spike", "donor_exodus", "coordination_shift"
	Severity    string  // "low", "medium", "high"
	Description string
	EpochFrom   int
	EpochTo     int
	Metric      float64 // the anomalous value
}

// DetectTemporalAnomalies compares allocation data between two epochs and detects
// suspicious temporal patterns like donor surges, funding spikes, whale entry, and
// coordinated donor behavior.
func DetectTemporalAnomalies(
	currentDonors []string, currentAmounts []float64, currentProjects []string,
	prevDonors []string, prevAmounts []float64, prevProjects []string,
	epochFrom, epochTo int,
) []TemporalAnomaly {
	var anomalies []TemporalAnomaly

	// Build per-project stats for current epoch.
	type projectStats struct {
		donors  map[string]float64 // donor -> amount
		total   float64
		count   int
	}
	buildStats := func(donors []string, amounts []float64, projects []string) map[string]*projectStats {
		m := map[string]*projectStats{}
		for i := range projects {
			p := projects[i]
			if m[p] == nil {
				m[p] = &projectStats{donors: map[string]float64{}}
			}
			amt := 0.0
			if i < len(amounts) {
				amt = amounts[i]
			}
			d := ""
			if i < len(donors) {
				d = donors[i]
			}
			m[p].donors[d] += amt
			m[p].total += amt
			m[p].count++
		}
		return m
	}

	currStats := buildStats(currentDonors, currentAmounts, currentProjects)
	prevStats := buildStats(prevDonors, prevAmounts, prevProjects)

	// Build set of all previous-epoch donors.
	prevDonorSet := map[string]bool{}
	for _, d := range prevDonors {
		prevDonorSet[d] = true
	}

	for proj, curr := range currStats {
		prev := prevStats[proj]
		currDonorCount := len(curr.donors)

		if prev != nil {
			prevDonorCount := len(prev.donors)

			// 1. Donor Surge: >100% increase in unique donors
			if prevDonorCount > 0 {
				increase := float64(currDonorCount-prevDonorCount) / float64(prevDonorCount)
				if increase > 1.0 {
					anomalies = append(anomalies, TemporalAnomaly{
						Type:        "donor_surge",
						Severity:    "high",
						Description: fmt.Sprintf("Project %s donor count surged %.0f%% (%d → %d)", shortAddr(proj), increase*100, prevDonorCount, currDonorCount),
						EpochFrom:   epochFrom,
						EpochTo:     epochTo,
						Metric:      increase * 100,
					})
				}
			}

			// 2. Donor Exodus: >50% drop in donors
			if prevDonorCount > 0 {
				drop := float64(prevDonorCount-currDonorCount) / float64(prevDonorCount)
				if drop > 0.5 {
					anomalies = append(anomalies, TemporalAnomaly{
						Type:        "donor_exodus",
						Severity:    "medium",
						Description: fmt.Sprintf("Project %s lost %.0f%% of donors (%d → %d)", shortAddr(proj), drop*100, prevDonorCount, currDonorCount),
						EpochFrom:   epochFrom,
						EpochTo:     epochTo,
						Metric:      drop * 100,
					})
				}
			}

			// 3. Funding Spike: >300% increase in total funding
			if prev.total > 0 {
				spike := (curr.total - prev.total) / prev.total
				if spike > 3.0 {
					anomalies = append(anomalies, TemporalAnomaly{
						Type:        "funding_spike",
						Severity:    "high",
						Description: fmt.Sprintf("Project %s funding spiked %.0f%% (%.4f → %.4f ETH)", shortAddr(proj), spike*100, prev.total, curr.total),
						EpochFrom:   epochFrom,
						EpochTo:     epochTo,
						Metric:      spike * 100,
					})
				}
			}
		}

		// 4. New Whale Entry: new donor contributes >30% of project total
		if curr.total > 0 {
			for donor, amt := range curr.donors {
				if !prevDonorSet[donor] && amt/curr.total > 0.3 {
					anomalies = append(anomalies, TemporalAnomaly{
						Type:        "new_whale",
						Severity:    "high",
						Description: fmt.Sprintf("New donor %s contributes %.1f%% of project %s total (%.4f ETH)", shortAddr(donor), amt/curr.total*100, shortAddr(proj), amt),
						EpochFrom:   epochFrom,
						EpochTo:     epochTo,
						Metric:      amt / curr.total * 100,
					})
				}
			}
		}
	}

	// 5. Coordination Shift: >10 new donors all fund the same set of projects (Jaccard > 0.8)
	// Build per-new-donor project sets
	newDonorProjects := map[string][]string{}
	for i, d := range currentDonors {
		if !prevDonorSet[d] {
			p := ""
			if i < len(currentProjects) {
				p = currentProjects[i]
			}
			// Deduplicate projects per donor
			found := false
			for _, existing := range newDonorProjects[d] {
				if existing == p {
					found = true
					break
				}
			}
			if !found {
				newDonorProjects[d] = append(newDonorProjects[d], p)
			}
		}
	}

	// Only check if there are enough new donors
	if len(newDonorProjects) > 10 {
		newDonors := make([]string, 0, len(newDonorProjects))
		for d := range newDonorProjects {
			newDonors = append(newDonors, d)
		}
		sort.Strings(newDonors)

		// Use union-find to cluster new donors with Jaccard > 0.8
		parent := make(map[string]string, len(newDonors))
		for _, d := range newDonors {
			parent[d] = d
		}
		var find func(string) string
		find = func(x string) string {
			if parent[x] != x {
				parent[x] = find(parent[x])
			}
			return parent[x]
		}
		unionFn := func(a, b string) {
			ra, rb := find(a), find(b)
			if ra != rb {
				parent[ra] = rb
			}
		}

		for i := 0; i < len(newDonors); i++ {
			for j := i + 1; j < len(newDonors); j++ {
				j1 := ComputeJaccardSimilarity(newDonorProjects[newDonors[i]], newDonorProjects[newDonors[j]])
				if j1 > 0.8 {
					unionFn(newDonors[i], newDonors[j])
				}
			}
		}

		clusters := map[string][]string{}
		for _, d := range newDonors {
			root := find(d)
			clusters[root] = append(clusters[root], d)
		}

		for _, members := range clusters {
			if len(members) > 10 {
				anomalies = append(anomalies, TemporalAnomaly{
					Type:        "coordination_shift",
					Severity:    "high",
					Description: fmt.Sprintf("%d new donors fund nearly identical project sets (Jaccard > 0.8)", len(members)),
					EpochFrom:   epochFrom,
					EpochTo:     epochTo,
					Metric:      float64(len(members)),
				})
			}
		}
	}

	return anomalies
}

// --- helpers ---

func normalize(val, minV, maxV float64) float64 {
	if maxV <= minV {
		return 0
	}
	return (val - minV) / (maxV - minV)
}

func minMax(projects []ProjectMetrics, f func(ProjectMetrics) float64) (float64, float64) {
	mn, mx := math.MaxFloat64, -math.MaxFloat64
	for _, p := range projects {
		v := f(p)
		if v < mn {
			mn = v
		}
		if v > mx {
			mx = v
		}
	}
	return mn, mx
}
