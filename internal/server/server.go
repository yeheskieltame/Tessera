package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/yeheskieltame/tessera/internal/analysis"
	"github.com/yeheskieltame/tessera/internal/data"
	"github.com/yeheskieltame/tessera/internal/provider"
)

// jsonError writes a JSON error response.
func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// jsonOK writes a JSON success response.
func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// cors adds CORS headers for development.
func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

// logging wraps a handler with request logging.
func logging(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("--> %s %s", r.Method, r.URL.Path)
		next(w, r)
		log.Printf("<-- %s %s (%s)", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	}
}

// handle wraps a handler with CORS and logging middleware.
func handle(pattern string, h http.HandlerFunc) {
	http.HandleFunc(pattern, logging(cors(h)))
}

// weiToEth converts a wei string to ETH float64.
func weiToEth(wei string) float64 {
	n := new(big.Int)
	n.SetString(wei, 10)
	f := new(big.Float).SetInt(n)
	eth, _ := new(big.Float).Quo(f, big.NewFloat(1e18)).Float64()
	return eth
}

// parseEpoch reads the "epoch" query parameter, returning 0 if missing or invalid.
func parseEpoch(r *http.Request) int {
	s := r.URL.Query().Get("epoch")
	if s == "" {
		return 0
	}
	n, _ := strconv.Atoi(s)
	return n
}

// --- Route handlers ---

func handleStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	type serviceStatus struct {
		Name   string `json:"name"`
		Status string `json:"status"`
		Detail string `json:"detail,omitempty"`
	}
	var services []serviceStatus

	// Octant
	octant := data.NewOctantClient()
	if ep, err := octant.GetCurrentEpoch(ctx); err != nil {
		services = append(services, serviceStatus{"Octant API", "error", err.Error()})
	} else {
		services = append(services, serviceStatus{"Octant API", "ok", fmt.Sprintf("epoch %d", ep.CurrentEpoch)})
	}

	// Gitcoin
	gitcoin := data.NewGitcoinClient()
	if rounds, err := gitcoin.GetRounds(ctx, 1, 1); err != nil {
		services = append(services, serviceStatus{"Gitcoin GraphQL", "error", err.Error()})
	} else {
		services = append(services, serviceStatus{"Gitcoin GraphQL", "ok", fmt.Sprintf("%d rounds", len(rounds))})
	}

	// OSO
	oso := data.NewOSOClient()
	if _, err := oso.GetProjects(ctx, 1); err != nil {
		services = append(services, serviceStatus{"OSO API", "error", err.Error()})
	} else {
		services = append(services, serviceStatus{"OSO API", "ok", "connected"})
	}

	// AI
	ai := provider.New()
	services = append(services, serviceStatus{"AI Providers", "ok", fmt.Sprintf("%d configured", len(ai.Providers()))})

	jsonOK(w, map[string]any{"services": services})
}

func handleProviders(w http.ResponseWriter, r *http.Request) {
	ai := provider.New()
	providers := ai.Providers()
	type providerInfo struct {
		Name  string `json:"name"`
		Model string `json:"model"`
	}
	out := make([]providerInfo, len(providers))
	for i, p := range providers {
		out[i] = providerInfo{p.Name, p.Model}
	}
	jsonOK(w, map[string]any{"providers": out})
}

func handleCurrentEpoch(w http.ResponseWriter, r *http.Request) {
	octant := data.NewOctantClient()
	ep, err := octant.GetCurrentEpoch(r.Context())
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonOK(w, map[string]any{"currentEpoch": ep.CurrentEpoch})
}

func handleProjects(w http.ResponseWriter, r *http.Request) {
	epoch := parseEpoch(r)
	if epoch == 0 {
		jsonError(w, "epoch query parameter is required", http.StatusBadRequest)
		return
	}

	octant := data.NewOctantClient()
	projects, err := octant.GetProjects(r.Context(), epoch)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	jsonOK(w, map[string]any{"epoch": epoch, "projects": projects, "count": len(projects)})
}

func handleAnalyzeEpoch(w http.ResponseWriter, r *http.Request) {
	epoch := parseEpoch(r)
	if epoch == 0 {
		jsonError(w, "epoch query parameter is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	octant := data.NewOctantClient()
	rewards, err := octant.GetProjectRewards(ctx, epoch)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	if len(rewards) == 0 {
		jsonOK(w, map[string]any{"epoch": epoch, "projects": []any{}})
		return
	}

	metrics := make([]analysis.ProjectMetrics, len(rewards))
	for i, r := range rewards {
		alloc := analysis.WeiToEth(r.Allocated)
		matched := analysis.WeiToEth(r.Matched)
		metrics[i] = analysis.ProjectMetrics{
			Address:      r.Address,
			Allocated:    alloc,
			Matched:      matched,
			TotalFunding: alloc + matched,
		}
	}

	metrics = analysis.ComputeCompositeScores(metrics)
	k := 4
	if len(metrics) < 4 {
		k = len(metrics)
	}
	metrics = analysis.SimpleKMeans(metrics, k)
	sort.Slice(metrics, func(i, j int) bool { return metrics[i].CompositeScore > metrics[j].CompositeScore })

	type projectResult struct {
		Address  string  `json:"address"`
		Alloc    float64 `json:"allocated"`
		Matched  float64 `json:"matched"`
		Score    float64 `json:"score"`
		Cluster  int     `json:"cluster"`
		Rank     int     `json:"rank"`
	}
	out := make([]projectResult, len(metrics))
	for i, m := range metrics {
		out[i] = projectResult{
			Address: m.Address,
			Alloc:   m.Allocated,
			Matched: m.Matched,
			Score:   m.CompositeScore,
			Cluster: m.Cluster,
			Rank:    i + 1,
		}
	}

	jsonOK(w, map[string]any{"epoch": epoch, "projects": out})
}

func handleDetectAnomalies(w http.ResponseWriter, r *http.Request) {
	epoch := parseEpoch(r)
	if epoch == 0 {
		jsonError(w, "epoch query parameter is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	octant := data.NewOctantClient()
	allocations, err := octant.GetAllocations(ctx, epoch)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	if len(allocations) == 0 {
		jsonOK(w, map[string]any{"epoch": epoch, "report": nil})
		return
	}

	donors := make([]string, len(allocations))
	amounts := make([]float64, len(allocations))
	for i, a := range allocations {
		donors[i] = a.Donor
		amounts[i] = weiToEth(a.Amount)
	}

	report := analysis.DetectAnomalies(donors, amounts)

	jsonOK(w, map[string]any{
		"epoch": epoch,
		"report": map[string]any{
			"totalDonations":     report.TotalDonations,
			"uniqueDonors":       report.UniqueDonors,
			"totalAmount":        report.TotalAmount,
			"meanDonation":       report.MeanDonation,
			"medianDonation":     report.MedianDonation,
			"maxDonation":        report.MaxDonation,
			"whaleConcentration": report.WhaleConcentration,
			"flags":              report.Flags,
		},
	})
}

func handleTrustGraph(w http.ResponseWriter, r *http.Request) {
	epoch := parseEpoch(r)
	if epoch == 0 {
		jsonError(w, "epoch query parameter is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	octant := data.NewOctantClient()
	allocations, err := octant.GetAllocations(ctx, epoch)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	if len(allocations) == 0 {
		jsonOK(w, map[string]any{"epoch": epoch, "profiles": []any{}})
		return
	}

	projects := make([]string, len(allocations))
	donors := make([]string, len(allocations))
	amounts := make([]float64, len(allocations))
	for i, a := range allocations {
		projects[i] = a.Project
		donors[i] = a.Donor
		amounts[i] = weiToEth(a.Amount)
	}

	var prevDonors map[string]bool
	if epoch > 1 {
		prevAllocs, err := octant.GetAllocations(ctx, epoch-1)
		if err == nil {
			prevDonors = map[string]bool{}
			for _, a := range prevAllocs {
				prevDonors[a.Donor] = true
			}
		}
	}

	profiles := analysis.BuildTrustProfiles(projects, amounts, donors, prevDonors)

	type trustJSON struct {
		Address          string   `json:"address"`
		DonorCount       int      `json:"donorCount"`
		UniqueDonors     int      `json:"uniqueDonors"`
		DonorDiversity   float64  `json:"donorDiversity"`
		WhaleDepRatio    float64  `json:"whaleDepRatio"`
		CoordinationRisk float64  `json:"coordinationRisk"`
		RepeatDonors     int      `json:"repeatDonors"`
		Flags            []string `json:"flags"`
	}
	out := make([]trustJSON, len(profiles))
	for i, p := range profiles {
		flags := p.Flags
		if flags == nil {
			flags = []string{}
		}
		out[i] = trustJSON{
			Address:          p.Address,
			DonorCount:       p.DonorCount,
			UniqueDonors:     p.UniqueDonors,
			DonorDiversity:   p.DonorDiversity,
			WhaleDepRatio:    p.WhaleDepRatio,
			CoordinationRisk: p.CoordinationRisk,
			RepeatDonors:     p.RepeatDonors,
			Flags:            flags,
		}
	}

	jsonOK(w, map[string]any{"epoch": epoch, "profiles": out})
}

func handleSimulate(w http.ResponseWriter, r *http.Request) {
	epoch := parseEpoch(r)
	if epoch == 0 {
		jsonError(w, "epoch query parameter is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	octant := data.NewOctantClient()
	allocations, err := octant.GetAllocations(ctx, epoch)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	if len(allocations) == 0 {
		jsonOK(w, map[string]any{"epoch": epoch, "mechanisms": []any{}})
		return
	}

	projects := make([]string, len(allocations))
	donors := make([]string, len(allocations))
	amounts := make([]float64, len(allocations))
	inputs := make([]analysis.AllocationInput, len(allocations))
	for i, a := range allocations {
		eth := weiToEth(a.Amount)
		projects[i] = a.Project
		donors[i] = a.Donor
		amounts[i] = eth
		inputs[i] = analysis.AllocationInput{Donor: a.Donor, Project: a.Project, Amount: eth}
	}

	// Build trust scores for trust-weighted QF
	trustProfiles := analysis.BuildTrustProfiles(projects, amounts, donors, nil)
	trustScores := map[string]float64{}
	for _, tp := range trustProfiles {
		trustScores[tp.Address] = tp.DonorDiversity
	}

	original := analysis.SimulateStandardQF(inputs)
	original.Name = "Original (Standard QF)"
	capped := analysis.SimulateCappedQF(inputs, 0.10)
	equal := analysis.SimulateEqualWeight(inputs)
	trustWeighted := analysis.SimulateTrustWeightedQF(inputs, trustScores)

	marshalMech := func(m analysis.MechanismResult) map[string]any {
		type simProj struct {
			Address       string  `json:"address"`
			Allocated     float64 `json:"allocated"`
			OriginalAlloc float64 `json:"originalAlloc"`
			Change        float64 `json:"change"`
		}
		projs := make([]simProj, len(m.Projects))
		for i, p := range m.Projects {
			projs[i] = simProj{p.Address, p.Allocated, p.OriginalAlloc, p.Change}
		}
		return map[string]any{
			"name":           m.Name,
			"description":    m.Description,
			"giniCoeff":      m.GiniCoeff,
			"topShare":       m.TopShare,
			"aboveThreshold": m.AboveThreshold,
			"projects":       projs,
		}
	}

	jsonOK(w, map[string]any{
		"epoch": epoch,
		"mechanisms": []any{
			marshalMech(original),
			marshalMech(capped),
			marshalMech(equal),
			marshalMech(trustWeighted),
		},
	})
}

func handleEvaluate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		jsonError(w, "failed to read body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		jsonError(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if req.Name == "" || req.Description == "" {
		jsonError(w, "name and description are required", http.StatusBadRequest)
		return
	}

	ai := provider.New()
	if !ai.HasProviders() {
		jsonError(w, "no AI providers configured", http.StatusServiceUnavailable)
		return
	}

	result, err := analysis.EvaluateProject(r.Context(), ai, req.Name, req.Description, "")
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]any{
		"project":    result.Project,
		"evaluation": result.Evaluation,
		"model":      result.Model,
		"provider":   result.Provider,
	})
}

func handleAnalyzeProject(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		jsonError(w, "failed to read body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var req struct {
		Address string `json:"address"`
		Epoch   int    `json:"epoch,omitempty"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		jsonError(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	if req.Address == "" {
		jsonError(w, "address is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	octant := data.NewOctantClient()

	// Get current epoch
	ep, err := octant.GetCurrentEpoch(ctx)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}

	// Fetch history
	history, err := octant.GetProjectHistory(ctx, req.Address, 1, ep.CurrentEpoch)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	if len(history) == 0 {
		jsonError(w, "project not found in any epoch", http.StatusNotFound)
		return
	}

	epoch := req.Epoch
	if epoch == 0 {
		epoch = history[len(history)-1].Epoch
	}

	// Quantitative scoring
	rewards, err := octant.GetProjectRewards(ctx, epoch)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}

	metrics := make([]analysis.ProjectMetrics, len(rewards))
	for i, r := range rewards {
		alloc := analysis.WeiToEth(r.Allocated)
		matched := analysis.WeiToEth(r.Matched)
		metrics[i] = analysis.ProjectMetrics{
			Address:      r.Address,
			Allocated:    alloc,
			Matched:      matched,
			TotalFunding: alloc + matched,
		}
	}
	metrics = analysis.ComputeCompositeScores(metrics)
	sort.Slice(metrics, func(i, j int) bool { return metrics[i].CompositeScore > metrics[j].CompositeScore })

	var projectMetric analysis.ProjectMetrics
	projectRank := 0
	for i, m := range metrics {
		if strings.EqualFold(m.Address, req.Address) {
			projectMetric = m
			projectRank = i + 1
			break
		}
	}

	// Trust profile
	allocations, err := octant.GetAllocations(ctx, epoch)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}

	allProjects := make([]string, len(allocations))
	allDonors := make([]string, len(allocations))
	allAmounts := make([]float64, len(allocations))
	for i, a := range allocations {
		allProjects[i] = a.Project
		allDonors[i] = a.Donor
		allAmounts[i] = weiToEth(a.Amount)
	}

	var prevDonors map[string]bool
	if epoch > 1 {
		prevAllocs, _ := octant.GetAllocations(ctx, epoch-1)
		if prevAllocs != nil {
			prevDonors = map[string]bool{}
			for _, a := range prevAllocs {
				prevDonors[a.Donor] = true
			}
		}
	}

	trustProfiles := analysis.BuildTrustProfiles(allProjects, allAmounts, allDonors, prevDonors)
	var projectTrust *analysis.TrustProfile
	for i, tp := range trustProfiles {
		if strings.EqualFold(tp.Address, req.Address) {
			projectTrust = &trustProfiles[i]
			break
		}
	}

	// Mechanism simulation
	inputs := make([]analysis.AllocationInput, len(allocations))
	for i := range allocations {
		inputs[i] = analysis.AllocationInput{Donor: allDonors[i], Project: allProjects[i], Amount: allAmounts[i]}
	}
	trustScores := map[string]float64{}
	for _, tp := range trustProfiles {
		trustScores[tp.Address] = tp.DonorDiversity
	}

	original := analysis.SimulateStandardQF(inputs)
	original.Name = "Original (Standard QF)"
	capped := analysis.SimulateCappedQF(inputs, 0.10)
	equal := analysis.SimulateEqualWeight(inputs)
	trustWeighted := analysis.SimulateTrustWeightedQF(inputs, trustScores)

	findProject := func(mech analysis.MechanismResult) *analysis.SimulatedProject {
		for _, p := range mech.Projects {
			if strings.EqualFold(p.Address, req.Address) {
				return &p
			}
		}
		return nil
	}

	type mechImpact struct {
		Name      string  `json:"name"`
		Allocated float64 `json:"allocated"`
		Change    float64 `json:"change"`
	}
	var mechImpacts []mechImpact
	for _, mech := range []analysis.MechanismResult{original, capped, equal, trustWeighted} {
		p := findProject(mech)
		if p != nil {
			mechImpacts = append(mechImpacts, mechImpact{mech.Name, p.Allocated, p.Change})
		}
	}

	// History
	type histEntry struct {
		Epoch     int     `json:"epoch"`
		Allocated float64 `json:"allocated"`
		Matched   float64 `json:"matched"`
		Donors    int     `json:"donors"`
	}
	histOut := make([]histEntry, len(history))
	for i, h := range history {
		histOut[i] = histEntry{h.Epoch, h.Allocated, h.Matched, h.Donors}
	}

	result := map[string]any{
		"address": req.Address,
		"epoch":   epoch,
		"rank":    projectRank,
		"totalProjects": len(metrics),
		"quantitative": map[string]any{
			"allocated":      projectMetric.Allocated,
			"matched":        projectMetric.Matched,
			"totalFunding":   projectMetric.TotalFunding,
			"compositeScore": projectMetric.CompositeScore,
			"cluster":        projectMetric.Cluster,
		},
		"history":          histOut,
		"mechanismImpacts": mechImpacts,
	}

	if projectTrust != nil {
		flags := projectTrust.Flags
		if flags == nil {
			flags = []string{}
		}
		result["trust"] = map[string]any{
			"uniqueDonors":     projectTrust.UniqueDonors,
			"donorDiversity":   projectTrust.DonorDiversity,
			"whaleDepRatio":    projectTrust.WhaleDepRatio,
			"coordinationRisk": projectTrust.CoordinationRisk,
			"repeatDonors":     projectTrust.RepeatDonors,
			"flags":            flags,
		}
	}

	jsonOK(w, result)
}

func handleListReports(w http.ResponseWriter, r *http.Request) {
	dir := "reports"
	entries, err := os.ReadDir(dir)
	if err != nil {
		jsonOK(w, map[string]any{"reports": []any{}})
		return
	}

	type reportEntry struct {
		Filename string `json:"filename"`
		Size     int64  `json:"size"`
		Modified string `json:"modified"`
	}
	var reports []reportEntry
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if strings.HasSuffix(e.Name(), ".pdf") {
			info, err := e.Info()
			if err != nil {
				continue
			}
			reports = append(reports, reportEntry{
				Filename: e.Name(),
				Size:     info.Size(),
				Modified: info.ModTime().Format(time.RFC3339),
			})
		}
	}
	if reports == nil {
		reports = []reportEntry{}
	}
	jsonOK(w, map[string]any{"reports": reports})
}

func handleServeReport(w http.ResponseWriter, r *http.Request) {
	// Extract filename from path: /api/reports/foo.pdf
	filename := strings.TrimPrefix(r.URL.Path, "/api/reports/")
	if filename == "" || strings.Contains(filename, "/") || strings.Contains(filename, "..") {
		jsonError(w, "invalid filename", http.StatusBadRequest)
		return
	}
	if !strings.HasSuffix(filename, ".pdf") {
		jsonError(w, "only PDF files are served", http.StatusBadRequest)
		return
	}

	path := filepath.Join("reports", filename)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		jsonError(w, "report not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%q", filename))
	http.ServeFile(w, r, path)
}

// loadRoutes registers all API routes and the static file server.
func loadRoutes() {
	// API endpoints
	handle("/api/status", handleStatus)
	handle("/api/providers", handleProviders)
	handle("/api/epochs/current", handleCurrentEpoch)
	handle("/api/projects", handleProjects)
	handle("/api/analyze-epoch", handleAnalyzeEpoch)
	handle("/api/detect-anomalies", handleDetectAnomalies)
	handle("/api/trust-graph", handleTrustGraph)
	handle("/api/simulate", handleSimulate)
	handle("/api/evaluate", handleEvaluate)
	handle("/api/analyze-project", handleAnalyzeProject)
	handle("/api/reports", func(w http.ResponseWriter, r *http.Request) {
		// Route to list vs serve based on path
		if r.URL.Path == "/api/reports" || r.URL.Path == "/api/reports/" {
			handleListReports(w, r)
		} else {
			handleServeReport(w, r)
		}
	})

	// Serve report files under /api/reports/<filename>
	http.HandleFunc("/api/reports/", logging(cors(handleServeReport)))

	// Serve static frontend files from ./frontend/dist
	fs := http.FileServer(http.Dir("./frontend/dist"))
	http.Handle("/", fs)
}

// Start initializes routes and starts the HTTP server.
func Start() {
	loadRoutes()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	fmt.Printf("Tessera API server running on http://localhost:%s\n", port)
	fmt.Printf("  API:      http://localhost:%s/api/status\n", port)
	fmt.Printf("  Frontend: http://localhost:%s/\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
