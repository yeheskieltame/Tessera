package analysis

import (
	"fmt"
	"math"
	"testing"
)

func TestWeiToEth(t *testing.T) {
	tests := []struct {
		name string
		wei  string
		want float64
	}{
		{"zero", "0", 0},
		{"one eth", "1000000000000000000", 1.0},
		{"half eth", "500000000000000000", 0.5},
		{"small amount", "1000000000000000", 0.001},
		{"large amount", "123456789000000000000", 123.456789},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := WeiToEth(tt.wei)
			if math.Abs(got-tt.want) > 1e-6 {
				t.Errorf("WeiToEth(%q) = %v, want %v", tt.wei, got, tt.want)
			}
		})
	}
}

func TestNormalize(t *testing.T) {
	tests := []struct {
		val, min, max, want float64
	}{
		{5, 0, 10, 0.5},
		{0, 0, 10, 0},
		{10, 0, 10, 1},
		{5, 5, 5, 0}, // equal min/max
	}
	for _, tt := range tests {
		got := normalize(tt.val, tt.min, tt.max)
		if math.Abs(got-tt.want) > 1e-9 {
			t.Errorf("normalize(%v, %v, %v) = %v, want %v", tt.val, tt.min, tt.max, got, tt.want)
		}
	}
}

func TestMinMax(t *testing.T) {
	projects := []ProjectMetrics{
		{Allocated: 10},
		{Allocated: 50},
		{Allocated: 30},
	}
	mn, mx := minMax(projects, func(p ProjectMetrics) float64 { return p.Allocated })
	if mn != 10 || mx != 50 {
		t.Errorf("minMax = (%v, %v), want (10, 50)", mn, mx)
	}
}

func TestComputeCompositeScores(t *testing.T) {
	projects := []ProjectMetrics{
		{Address: "0xAAA", Allocated: 100, Matched: 200},
		{Address: "0xBBB", Allocated: 0, Matched: 0},
		{Address: "0xCCC", Allocated: 50, Matched: 100},
	}

	result := ComputeCompositeScores(projects)

	// 0xAAA should have score 100 (max in both)
	if result[0].CompositeScore != 100.0 {
		t.Errorf("max project score = %v, want 100", result[0].CompositeScore)
	}

	// 0xBBB should have score 0 (min in both)
	if result[1].CompositeScore != 0.0 {
		t.Errorf("min project score = %v, want 0", result[1].CompositeScore)
	}

	// 0xCCC should be 50 (midpoint normalized: 0.5*0.4 + 0.5*0.6 = 0.5 → 50)
	if result[2].CompositeScore != 50.0 {
		t.Errorf("mid project score = %v, want 50", result[2].CompositeScore)
	}
}

func TestComputeCompositeScoresEmpty(t *testing.T) {
	result := ComputeCompositeScores(nil)
	if result != nil {
		t.Errorf("expected nil for empty input")
	}
}

func TestComputeCompositeScoresSingle(t *testing.T) {
	projects := []ProjectMetrics{
		{Address: "0xAAA", Allocated: 100, Matched: 200},
	}
	result := ComputeCompositeScores(projects)
	// Single project: min == max, normalize returns 0
	if result[0].CompositeScore != 0.0 {
		t.Errorf("single project score = %v, want 0", result[0].CompositeScore)
	}
}

func TestSimpleKMeans(t *testing.T) {
	projects := []ProjectMetrics{
		{Address: "A", Allocated: 100, Matched: 100, TotalFunding: 200},
		{Address: "B", Allocated: 90, Matched: 95, TotalFunding: 185},
		{Address: "C", Allocated: 10, Matched: 5, TotalFunding: 15},
		{Address: "D", Allocated: 5, Matched: 10, TotalFunding: 15},
		{Address: "E", Allocated: 50, Matched: 50, TotalFunding: 100},
		{Address: "F", Allocated: 55, Matched: 45, TotalFunding: 100},
	}

	result := SimpleKMeans(projects, 3)

	// Check all projects have cluster assignments
	for _, p := range result {
		if p.Cluster < 0 || p.Cluster >= 3 {
			t.Errorf("project %s has invalid cluster %d", p.Address, p.Cluster)
		}
	}

	// Similar projects should be in same cluster
	clusterA := findCluster(result, "A")
	clusterB := findCluster(result, "B")
	if clusterA != clusterB {
		t.Errorf("similar projects A and B in different clusters: %d vs %d", clusterA, clusterB)
	}

	clusterC := findCluster(result, "C")
	clusterD := findCluster(result, "D")
	if clusterC != clusterD {
		t.Errorf("similar projects C and D in different clusters: %d vs %d", clusterC, clusterD)
	}
}

func TestSimpleKMeansEdgeCases(t *testing.T) {
	// Empty
	result := SimpleKMeans(nil, 3)
	if result != nil {
		t.Error("expected nil for empty input")
	}

	// k = 0
	projects := []ProjectMetrics{{Address: "A", TotalFunding: 100}}
	result = SimpleKMeans(projects, 0)
	if len(result) != 1 {
		t.Error("expected unchanged for k=0")
	}

	// k > n
	result = SimpleKMeans(projects, 5)
	if len(result) != 1 {
		t.Error("expected single project for k>n")
	}
}

func TestDetectAnomalies(t *testing.T) {
	donors := []string{"A", "B", "C", "D", "E"}
	amounts := []float64{1.0, 2.0, 3.0, 4.0, 5.0}

	r := DetectAnomalies(donors, amounts)

	if r.TotalDonations != 5 {
		t.Errorf("TotalDonations = %d, want 5", r.TotalDonations)
	}
	if r.UniqueDonors != 5 {
		t.Errorf("UniqueDonors = %d, want 5", r.UniqueDonors)
	}
	if math.Abs(r.TotalAmount-15.0) > 1e-9 {
		t.Errorf("TotalAmount = %v, want 15", r.TotalAmount)
	}
	if math.Abs(r.MeanDonation-3.0) > 1e-9 {
		t.Errorf("MeanDonation = %v, want 3", r.MeanDonation)
	}
	if math.Abs(r.MedianDonation-3.0) > 1e-9 {
		t.Errorf("MedianDonation = %v, want 3", r.MedianDonation)
	}
	if math.Abs(r.MaxDonation-5.0) > 1e-9 {
		t.Errorf("MaxDonation = %v, want 5", r.MaxDonation)
	}
}

func TestDetectAnomaliesEmpty(t *testing.T) {
	r := DetectAnomalies(nil, nil)
	if r.TotalDonations != 0 {
		t.Errorf("expected 0 donations for empty input")
	}
}

func TestDetectAnomaliesMedianEven(t *testing.T) {
	donors := []string{"A", "B", "C", "D"}
	amounts := []float64{1.0, 2.0, 3.0, 4.0}

	r := DetectAnomalies(donors, amounts)

	if math.Abs(r.MedianDonation-2.5) > 1e-9 {
		t.Errorf("MedianDonation = %v, want 2.5", r.MedianDonation)
	}
}

func TestDetectAnomaliesWhaleFlag(t *testing.T) {
	// Create scenario with heavy whale concentration (>10 donors needed)
	donors := make([]string, 20)
	amounts := make([]float64, 20)
	for i := 0; i < 19; i++ {
		donors[i] = fmt.Sprintf("small_%d", i)
		amounts[i] = 0.01
	}
	// One whale with 99% of total
	donors[19] = "whale"
	amounts[19] = 100.0

	r := DetectAnomalies(donors, amounts)

	if r.WhaleConcentration < 0.5 {
		t.Errorf("WhaleConcentration = %v, expected > 0.5", r.WhaleConcentration)
	}
	if len(r.Flags) == 0 {
		t.Error("expected whale flag to be raised")
	}
}

func TestDetectAnomaliesCoordinatedFlag(t *testing.T) {
	// Create many donations of exact same amount (>2% and >= 5)
	donors := make([]string, 250)
	amounts := make([]float64, 250)
	for i := 0; i < 250; i++ {
		donors[i] = fmt.Sprintf("donor_%d", i)
		amounts[i] = 0.5 // all same amount, above 0.001 threshold
	}

	r := DetectAnomalies(donors, amounts)

	hasCoordFlag := false
	for _, f := range r.Flags {
		if len(f) > 0 {
			hasCoordFlag = true
		}
	}
	if !hasCoordFlag {
		t.Error("expected coordinated donation flag for 250 identical amounts")
	}
}

// helper
func findCluster(projects []ProjectMetrics, addr string) int {
	for _, p := range projects {
		if p.Address == addr {
			return p.Cluster
		}
	}
	return -1
}

