package analysis

import (
	"math"
	"sort"
)

// TrustProfile holds trust metrics for a project derived from donor-project
// bipartite graph analysis.
type TrustProfile struct {
	Address          string
	DonorCount       int
	UniqueDonors     int
	DonorDiversity   float64 // 0-1, higher = more diverse (Shannon entropy)
	WhaleDepRatio    float64 // fraction of funding from top donor
	CoordinationRisk float64 // 0-1, max Jaccard similarity of donor overlap with any other project
	RepeatDonors     int     // donors who funded in previous epochs too
	Flags            []string
}

// BuildTrustProfiles constructs a TrustProfile for every project found in the
// given allocations. previousDonors is a set of donor addresses seen in earlier
// epochs (used for RepeatDonors calculation); it may be nil.
func BuildTrustProfiles(
	projects []string,
	amounts []float64,
	donors []string,
	previousDonors map[string]bool,
) []TrustProfile {
	// Group allocations by project.
	type donation struct {
		donor  string
		amount float64
	}
	projectDonations := map[string][]donation{}
	for i := range projects {
		p := projects[i]
		d := donors[i]
		a := 0.0
		if i < len(amounts) {
			a = amounts[i]
		}
		projectDonations[p] = append(projectDonations[p], donation{donor: d, amount: a})
	}

	// Build per-project donor sets (needed for coordination risk).
	projectDonorSets := map[string]map[string]bool{}
	for p, dons := range projectDonations {
		s := map[string]bool{}
		for _, d := range dons {
			s[d.donor] = true
		}
		projectDonorSets[p] = s
	}

	// Convert donor sets to slices for Jaccard computation.
	projectDonorSlices := map[string][]string{}
	for p, s := range projectDonorSets {
		sl := make([]string, 0, len(s))
		for d := range s {
			sl = append(sl, d)
		}
		projectDonorSlices[p] = sl
	}

	// All project addresses (sorted for deterministic output).
	allProjects := make([]string, 0, len(projectDonations))
	for p := range projectDonations {
		allProjects = append(allProjects, p)
	}
	sort.Strings(allProjects)

	profiles := make([]TrustProfile, 0, len(allProjects))

	for _, proj := range allProjects {
		dons := projectDonations[proj]
		tp := TrustProfile{
			Address:    proj,
			DonorCount: len(dons),
		}

		// Unique donors and amounts per donor.
		donorAmounts := map[string]float64{}
		for _, d := range dons {
			donorAmounts[d.donor] += d.amount
		}
		tp.UniqueDonors = len(donorAmounts)

		// Donor amounts as slices for diversity computation.
		uniqueDonors := make([]string, 0, len(donorAmounts))
		amts := make([]float64, 0, len(donorAmounts))
		for d, a := range donorAmounts {
			uniqueDonors = append(uniqueDonors, d)
			amts = append(amts, a)
		}

		// Donor diversity (Shannon entropy).
		tp.DonorDiversity = ComputeDonorDiversity(uniqueDonors, amts)

		// Whale dependency ratio: fraction from top donor.
		var total float64
		var maxAmt float64
		for _, a := range amts {
			total += a
			if a > maxAmt {
				maxAmt = a
			}
		}
		if total > 0 {
			tp.WhaleDepRatio = maxAmt / total
		}

		// Coordination risk: max Jaccard similarity with any other project.
		maxJaccard := 0.0
		donorsA := projectDonorSlices[proj]
		for _, other := range allProjects {
			if other == proj {
				continue
			}
			j := ComputeJaccardSimilarity(donorsA, projectDonorSlices[other])
			if j > maxJaccard {
				maxJaccard = j
			}
		}
		tp.CoordinationRisk = maxJaccard

		// Repeat donors from previous epochs.
		if previousDonors != nil {
			for _, d := range uniqueDonors {
				if previousDonors[d] {
					tp.RepeatDonors++
				}
			}
		}

		// Generate flags.
		if tp.WhaleDepRatio > 0.5 {
			tp.Flags = append(tp.Flags, "high whale dependency: top donor provides >50% of funding")
		}
		if tp.CoordinationRisk > 0.7 {
			tp.Flags = append(tp.Flags, "high coordination risk: donor overlap >70% with another project")
		}
		if tp.UniqueDonors < 3 {
			tp.Flags = append(tp.Flags, "very few unique donors")
		}
		if tp.DonorDiversity < 0.3 && tp.UniqueDonors > 1 {
			tp.Flags = append(tp.Flags, "low donor diversity: funding highly concentrated")
		}

		profiles = append(profiles, tp)
	}

	return profiles
}

// ComputeJaccardSimilarity returns the Jaccard index J(A,B) = |A∩B| / |A∪B|.
// Returns 0 when both sets are empty.
func ComputeJaccardSimilarity(donorsA, donorsB []string) float64 {
	if len(donorsA) == 0 && len(donorsB) == 0 {
		return 0
	}

	setA := make(map[string]bool, len(donorsA))
	for _, d := range donorsA {
		setA[d] = true
	}

	intersection := 0
	setB := make(map[string]bool, len(donorsB))
	for _, d := range donorsB {
		setB[d] = true
		if setA[d] {
			intersection++
		}
	}

	union := len(setA) + len(setB) - intersection
	if union == 0 {
		return 0
	}
	return float64(intersection) / float64(union)
}

// DetectDonorClusters finds groups of donors that consistently fund the same
// set of projects (Jaccard similarity of their funded-project sets > 0.7).
// Input: per-donor list of funded projects.
func DetectDonorClusters(
	donorProjects map[string][]string,
) [][]string {
	// Build list of donors.
	donors := make([]string, 0, len(donorProjects))
	for d := range donorProjects {
		donors = append(donors, d)
	}
	sort.Strings(donors)

	// Union-Find for clustering.
	parent := make(map[string]string, len(donors))
	for _, d := range donors {
		parent[d] = d
	}

	var find func(string) string
	find = func(x string) string {
		if parent[x] != x {
			parent[x] = find(parent[x])
		}
		return parent[x]
	}
	union := func(a, b string) {
		ra, rb := find(a), find(b)
		if ra != rb {
			parent[ra] = rb
		}
	}

	// Compare every pair; union if Jaccard > 0.7.
	for i := 0; i < len(donors); i++ {
		for j := i + 1; j < len(donors); j++ {
			j1 := ComputeJaccardSimilarity(donorProjects[donors[i]], donorProjects[donors[j]])
			if j1 > 0.7 {
				union(donors[i], donors[j])
			}
		}
	}

	// Collect clusters.
	clusters := map[string][]string{}
	for _, d := range donors {
		root := find(d)
		clusters[root] = append(clusters[root], d)
	}

	// Return only clusters with 2+ members.
	result := make([][]string, 0)
	for _, members := range clusters {
		if len(members) >= 2 {
			sort.Strings(members)
			result = append(result, members)
		}
	}

	// Sort clusters by size descending for deterministic output.
	sort.Slice(result, func(i, j int) bool {
		return len(result[i]) > len(result[j])
	})

	return result
}

// ComputeDonorDiversity calculates the normalized Shannon entropy of the
// donation distribution. Returns a value between 0 (single donor / all funding
// from one source) and 1 (perfectly uniform distribution across all donors).
func ComputeDonorDiversity(donors []string, amounts []float64) float64 {
	n := len(donors)
	if n <= 1 {
		return 0
	}

	// Sum total.
	var total float64
	for _, a := range amounts {
		if a > 0 {
			total += a
		}
	}
	if total == 0 {
		return 0
	}

	// Shannon entropy H = -Σ p_i * ln(p_i).
	var entropy float64
	for _, a := range amounts {
		if a > 0 {
			p := a / total
			if p > 0 {
				entropy -= p * math.Log(p)
			}
		}
	}

	// Normalize by max entropy (ln(n)) to get 0-1 range.
	maxEntropy := math.Log(float64(n))
	if maxEntropy == 0 {
		return 0
	}

	diversity := entropy / maxEntropy
	// Clamp to [0, 1] for floating-point safety.
	if diversity > 1 {
		diversity = 1
	}
	if diversity < 0 {
		diversity = 0
	}
	return diversity
}
