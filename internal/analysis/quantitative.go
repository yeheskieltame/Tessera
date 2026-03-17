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
