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
	"github.com/yeheskieltame/tessera/internal/report"
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

	// Blockchain
	bc := data.NewBlockchainClient()
	reachable, total := bc.CheckConnectivity(ctx)
	if reachable > 0 {
		services = append(services, serviceStatus{"Blockchain RPC", "ok", fmt.Sprintf("%d/%d chains", reachable, total)})
	} else {
		services = append(services, serviceStatus{"Blockchain RPC", "error", "no chains reachable"})
	}

	// AI
	ai := provider.New()
	services = append(services, serviceStatus{"AI Providers", "ok", fmt.Sprintf("%d configured", len(ai.Providers()))})

	jsonOK(w, map[string]any{"services": services})
}

func handleProviders(w http.ResponseWriter, r *http.Request) {
	ai := provider.New()
	all := ai.AllProviders()
	prefProvider, prefModel := provider.GetPreferred()
	jsonOK(w, map[string]any{
		"providers":      all,
		"preferred":      prefProvider,
		"preferredModel": prefModel,
	})
}

func handleSelectProvider(w http.ResponseWriter, r *http.Request) {
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
		Provider string `json:"provider"`
		Model    string `json:"model"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate provider+model combo exists and is ready
	ai := provider.New()
	all := ai.AllProviders()
	found := false
	for _, p := range all {
		if p.Name == req.Provider && p.Model == req.Model {
			if !p.Ready {
				jsonError(w, fmt.Sprintf("provider %s/%s is not ready: %s", req.Provider, req.Model, p.Reason), http.StatusBadRequest)
				return
			}
			found = true
			break
		}
	}
	if !found && req.Provider != "" {
		jsonError(w, fmt.Sprintf("unknown provider+model: %s/%s", req.Provider, req.Model), http.StatusBadRequest)
		return
	}

	provider.SetPreferred(req.Provider, req.Model)
	jsonOK(w, map[string]any{"preferred": req.Provider, "preferredModel": req.Model, "status": "ok"})
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
		GitHubURL   string `json:"githubURL"`
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

	result, err := analysis.EvaluateProject(r.Context(), ai, req.Name, req.Description, "", req.GitHubURL)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Generate PDF report
	metadata := map[string]string{
		"Project":  req.Name,
		"AI Model": result.Model,
	}
	if req.GitHubURL != "" {
		metadata["GitHub"] = req.GitHubURL
	}

	sections := []report.PDFSection{
		{Heading: "Project Description", Body: req.Description},
	}
	if req.GitHubURL != "" {
		owner, repo, ghErr := data.ParseGitHubURL(req.GitHubURL)
		if ghErr == nil {
			gh := data.NewGitHubClient()
			signals := gh.CollectEvalSignals(r.Context(), owner, repo)
			if formatted := signals.FormatForEval(); formatted != "" {
				sections = append(sections, report.PDFSection{
					Heading: "GitHub Repository Data",
					Body:    formatted,
				})
			}
		}
	}
	sections = append(sections, report.PDFSection{
		Heading: "AI Evaluation",
		Body:    result.Evaluation,
	})

	pdfReport := &report.PDFReport{
		Title:    fmt.Sprintf("Project Evaluation: %s", req.Name),
		Subtitle: "AI-Powered Qualitative Assessment",
		Model:    result.Model,
		Provider: result.Provider,
		Metadata: metadata,
		Sections: sections,
	}

	var reportPath string
	if pdfPath, pdfErr := report.GeneratePDF(pdfReport); pdfErr == nil {
		reportPath = pdfPath
	}

	jsonOK(w, map[string]any{
		"project":    result.Project,
		"evaluation": result.Evaluation,
		"model":      result.Model,
		"provider":   result.Provider,
		"reportPath": reportPath,
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
		Name     string `json:"name"`
		Size     int64  `json:"size"`
		ModTime  string `json:"modTime"`
		Type     string `json:"type"`
	}
	var reports []reportEntry
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		ftype := "unknown"
		if strings.HasSuffix(e.Name(), ".pdf") {
			ftype = "pdf"
		} else if strings.HasSuffix(e.Name(), ".md") {
			ftype = "markdown"
		}
		reports = append(reports, reportEntry{
			Name:    e.Name(),
			Size:    info.Size(),
			ModTime: info.ModTime().Format(time.RFC3339),
			Type:    ftype,
		})
	}
	if reports == nil {
		reports = []reportEntry{}
	}
	jsonOK(w, map[string]any{"reports": reports})
}

func handleServeReport(w http.ResponseWriter, r *http.Request) {
	// Extract filename from path: /api/reports/foo.pdf
	filename := strings.TrimPrefix(r.URL.Path, "/api/reports/")
	if filename == "" || strings.Contains(filename, "/") || strings.HasPrefix(filename, "..") {
		jsonError(w, "invalid filename", http.StatusBadRequest)
		return
	}
	path := filepath.Join("reports", filename)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		jsonError(w, "report not found", http.StatusNotFound)
		return
	}

	if strings.HasSuffix(filename, ".pdf") {
		w.Header().Set("Content-Type", "application/pdf")
	} else if strings.HasSuffix(filename, ".md") {
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	} else {
		w.Header().Set("Content-Type", "application/octet-stream")
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%q", filename))
	http.ServeFile(w, r, path)
}

// --- SSE helpers ---

// sseWriter wraps an http.ResponseWriter for Server-Sent Events streaming.
type sseWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

// newSSEWriter sets up SSE headers and returns a writer. Returns nil if streaming is unsupported.
func newSSEWriter(w http.ResponseWriter) *sseWriter {
	flusher, ok := w.(http.Flusher)
	if !ok {
		jsonError(w, "streaming not supported", http.StatusInternalServerError)
		return nil
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()
	return &sseWriter{w: w, flusher: flusher}
}

// sendEvent writes a single SSE data event and flushes.
func (s *sseWriter) sendEvent(v any) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	fmt.Fprintf(s.w, "data: %s\n\n", b)
	s.flusher.Flush()
}

// sendStep emits a progress step.
func (s *sseWriter) sendStep(step, total int, message string, payload any) {
	evt := map[string]any{
		"step":    step,
		"total":   total,
		"message": message,
	}
	if payload != nil {
		evt["data"] = payload
	}
	s.sendEvent(evt)
}

// sendDone emits the final "done" event with the full result.
func (s *sseWriter) sendDone(result any) {
	s.sendEvent(map[string]any{"step": "done", "result": result})
}

// sendError emits an error event.
func (s *sseWriter) sendError(msg string) {
	s.sendEvent(map[string]any{"step": "error", "error": msg})
}

// --- SSE streaming handlers for long-running operations ---

// collectAllocData is a helper that fetches allocations and computes common derived slices.
type allocData struct {
	allocations []data.Allocation
	projects    []string
	donors      []string
	amounts     []float64
	prevDonors  map[string]bool
}

func collectAllocData(ctx context.Context, octant *data.OctantClient, epoch int) (*allocData, error) {
	allocations, err := octant.GetAllocations(ctx, epoch)
	if err != nil {
		return nil, err
	}
	d := &allocData{allocations: allocations}
	d.projects = make([]string, len(allocations))
	d.donors = make([]string, len(allocations))
	d.amounts = make([]float64, len(allocations))
	for i, a := range allocations {
		d.projects[i] = a.Project
		d.donors[i] = a.Donor
		d.amounts[i] = weiToEth(a.Amount)
	}
	if epoch > 1 {
		prevAllocs, err := octant.GetAllocations(ctx, epoch-1)
		if err == nil && prevAllocs != nil {
			d.prevDonors = map[string]bool{}
			for _, a := range prevAllocs {
				d.prevDonors[a.Donor] = true
			}
		}
	}
	return d, nil
}

// handleEvaluateStream streams a 5-step project evaluation via SSE.
// Steps: 1-Input validation, 2-GitHub signals, 3-AI evaluation (8 dim), 4-Signal reliability, 5-PDF generation
// GET /api/evaluate/stream?name=...&description=...&githubURL=...
func handleEvaluateStream(w http.ResponseWriter, r *http.Request) {
	sse := newSSEWriter(w)
	if sse == nil {
		return
	}

	name := r.URL.Query().Get("name")
	description := r.URL.Query().Get("description")
	githubURL := r.URL.Query().Get("githubURL")

	totalSteps := 5

	// Step 1: Validate input
	sse.sendStep(1, totalSteps, "Validating input...", nil)
	if name == "" || description == "" {
		sse.sendError("name and description are required")
		return
	}
	ai := provider.New()
	if !ai.HasProviders() {
		sse.sendError("no AI providers configured")
		return
	}
	sse.sendStep(1, totalSteps, fmt.Sprintf("Project: %s", name), map[string]any{
		"name":        name,
		"description": description[:min(200, len(description))],
		"hasGitHub":   githubURL != "",
	})

	// Step 2: Collect GitHub signals (if URL provided)
	ctx := r.Context()
	var githubContext string
	var hasGitHub bool
	if githubURL != "" {
		sse.sendStep(2, totalSteps, fmt.Sprintf("Collecting GitHub signals from %s...", githubURL), nil)
		owner, repo, err := data.ParseGitHubURL(githubURL)
		if err == nil {
			gh := data.NewGitHubClient()
			signals := gh.CollectEvalSignals(ctx, owner, repo)
			githubContext = signals.FormatForEval()
			hasGitHub = githubContext != ""
		}
		if hasGitHub {
			sse.sendStep(2, totalSteps, "GitHub signals collected", map[string]any{"hasData": true})
		} else {
			sse.sendStep(2, totalSteps, "GitHub signals: no data found or URL invalid", map[string]any{"hasData": false})
		}
	} else {
		sse.sendStep(2, totalSteps, "GitHub signals skipped (no URL provided)", map[string]any{"hasData": false})
	}

	// Step 3: AI evaluation (8 dimensions)
	sse.sendStep(3, totalSteps, "Running AI evaluation across 8 dimensions...", nil)
	result, err := analysis.EvaluateProject(ctx, ai, name, description, "", githubURL)
	if err != nil {
		sse.sendStep(3, totalSteps, fmt.Sprintf("AI evaluation failed: %v", err), nil)
		sse.sendError(fmt.Sprintf("evaluation failed: %v", err))
		return
	}
	sse.sendStep(3, totalSteps, fmt.Sprintf("AI evaluation complete (via %s/%s)", result.Provider, result.Model), map[string]any{
		"evaluation": result.Evaluation,
		"model":      result.Model,
		"provider":   result.Provider,
	})

	// Step 4: Signal reliability assessment
	sse.sendStep(4, totalSteps, "Assessing signal reliability...", nil)
	reliabilityReport := analysis.AssessReliability(nil, nil, "", nil, hasGitHub, 0)
	var reliabilityData map[string]any
	if reliabilityReport != nil {
		reliabilityData = map[string]any{
			"overallScore":     reliabilityReport.OverallScore,
			"dataCompleteness": reliabilityReport.DataCompleteness,
			"highCount":        reliabilityReport.HighCount,
			"mediumCount":      reliabilityReport.MediumCount,
			"lowCount":         reliabilityReport.LowCount,
		}
	}
	sse.sendStep(4, totalSteps, fmt.Sprintf("Reliability: %.0f/100, completeness: %.0f%%",
		reliabilityReport.OverallScore, reliabilityReport.DataCompleteness), reliabilityData)

	// Step 5: Generate PDF report
	sse.sendStep(5, totalSteps, "Generating PDF report...", nil)
	metadata := map[string]string{
		"Project":  name,
		"AI Model": result.Model,
	}
	if githubURL != "" {
		metadata["GitHub"] = githubURL
	}
	sections := []report.PDFSection{
		{Heading: "Project Description", Body: description},
	}
	if githubContext != "" {
		sections = append(sections, report.PDFSection{Heading: "GitHub Repository Data", Body: githubContext})
	}
	reliabilityText := analysis.FormatReliabilityReport(reliabilityReport)
	if reliabilityText != "" {
		sections = append(sections, report.PDFSection{Heading: "Signal Reliability Assessment", Body: reliabilityText})
	}
	sections = append(sections, report.PDFSection{Heading: "AI Evaluation", Body: result.Evaluation})

	pdfReport := &report.PDFReport{
		Title:    fmt.Sprintf("Project Evaluation: %s", name),
		Subtitle: "AI-Powered Qualitative Assessment",
		Model:    result.Model,
		Provider: result.Provider,
		Metadata: metadata,
		Sections: sections,
	}

	var reportPath string
	if pdfPath, pdfErr := report.GeneratePDF(pdfReport); pdfErr == nil {
		reportPath = pdfPath
	}
	sse.sendStep(5, totalSteps, "PDF report generated", map[string]any{"reportPath": reportPath})

	// Done
	sse.sendDone(map[string]any{
		"project":     result.Project,
		"evaluation":  result.Evaluation,
		"model":       result.Model,
		"provider":    result.Provider,
		"reportPath":  reportPath,
		"reliability": reliabilityData,
	})
}

// handleAnalyzeProjectStream streams a full 8-step project analysis via SSE.
// Steps: 1-History, 2-Quantitative, 3-Trust, 4-Mechanism, 5-Temporal Anomaly, 6-Multi-Layer Score, 7-OSO, 8-AI Eval
// GET /api/analyze-project/stream?address=0x...&epoch=5&oso_name=optional
func handleAnalyzeProjectStream(w http.ResponseWriter, r *http.Request) {
	sse := newSSEWriter(w)
	if sse == nil {
		return
	}

	address := r.URL.Query().Get("address")
	if address == "" {
		sse.sendError("address query parameter is required")
		return
	}
	epochParam := parseEpoch(r)
	osoName := r.URL.Query().Get("oso_name")

	ctx := r.Context()
	octant := data.NewOctantClient()
	ai := provider.New()

	totalSteps := 11
	// Step 1: Cross-epoch history
	sse.sendStep(1, totalSteps, "Fetching cross-epoch funding history...", nil)
	ep, err := octant.GetCurrentEpoch(ctx)
	if err != nil {
		sse.sendError(fmt.Sprintf("failed to get current epoch: %v", err))
		return
	}
	history, err := octant.GetProjectHistory(ctx, address, 1, ep.CurrentEpoch)
	if err != nil {
		sse.sendError(fmt.Sprintf("failed to get project history: %v", err))
		return
	}
	if len(history) == 0 {
		sse.sendError("project not found in any Octant epoch")
		return
	}

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
	sse.sendStep(1, totalSteps, fmt.Sprintf("Found in %d epochs", len(history)), map[string]any{"history": histOut})


	epoch := epochParam
	if epoch == 0 {
		epoch = history[len(history)-1].Epoch
	}

	// Step 2: Quantitative scoring
	sse.sendStep(2, totalSteps, fmt.Sprintf("Quantitative analysis (Epoch %d)...", epoch), nil)
	rewards, err := octant.GetProjectRewards(ctx, epoch)
	if err != nil {
		sse.sendError(fmt.Sprintf("failed to get rewards: %v", err))
		return
	}

	metrics := make([]analysis.ProjectMetrics, len(rewards))
	for i, rw := range rewards {
		alloc := analysis.WeiToEth(rw.Allocated)
		matched := analysis.WeiToEth(rw.Matched)
		metrics[i] = analysis.ProjectMetrics{
			Address:      rw.Address,
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
		if strings.EqualFold(m.Address, address) {
			projectMetric = m
			projectRank = i + 1
			break
		}
	}
	sse.sendStep(2, totalSteps, fmt.Sprintf("Rank %d/%d, Score %.1f", projectRank, len(metrics), projectMetric.CompositeScore), map[string]any{
		"rank":           projectRank,
		"totalProjects":  len(metrics),
		"compositeScore": projectMetric.CompositeScore,
		"allocated":      projectMetric.Allocated,
		"matched":        projectMetric.Matched,
	})

	// Step 3: Trust graph analysis
	sse.sendStep(3, totalSteps, "Trust graph analysis...", nil)
	ad, err := collectAllocData(ctx, octant, epoch)
	if err != nil {
		sse.sendError(fmt.Sprintf("failed to get allocations: %v", err))
		return
	}

	trustProfiles := analysis.BuildTrustProfiles(ad.projects, ad.amounts, ad.donors, ad.prevDonors)
	var projectTrust *analysis.TrustProfile
	for i, tp := range trustProfiles {
		if strings.EqualFold(tp.Address, address) {
			projectTrust = &trustProfiles[i]
			break
		}
	}

	var trustData map[string]any
	if projectTrust != nil {
		flags := projectTrust.Flags
		if flags == nil {
			flags = []string{}
		}
		trustData = map[string]any{
			"uniqueDonors":     projectTrust.UniqueDonors,
			"donorDiversity":   projectTrust.DonorDiversity,
			"whaleDepRatio":    projectTrust.WhaleDepRatio,
			"coordinationRisk": projectTrust.CoordinationRisk,
			"repeatDonors":     projectTrust.RepeatDonors,
			"flags":            flags,
		}
	}
	sse.sendStep(3, totalSteps, "Trust profile computed", trustData)

	// Step 4: Mechanism simulation
	sse.sendStep(4, totalSteps, "Mechanism simulation impact...", nil)
	inputs := make([]analysis.AllocationInput, len(ad.allocations))
	for i := range ad.allocations {
		inputs[i] = analysis.AllocationInput{Donor: ad.donors[i], Project: ad.projects[i], Amount: ad.amounts[i]}
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
			if strings.EqualFold(p.Address, address) {
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
	sse.sendStep(4, totalSteps, "Mechanism simulations complete", map[string]any{"mechanisms": mechImpacts})

	// Step 5: Temporal anomaly detection
	sse.sendStep(5, totalSteps, "Detecting temporal anomalies...", nil)
	type anomalyOut struct {
		Type        string  `json:"type"`
		Severity    string  `json:"severity"`
		Description string  `json:"description"`
		Epoch       int     `json:"epoch"`
		Metric      float64 `json:"metric"`
	}
	anomalyList := []anomalyOut{}

	if len(history) >= 2 {
		prevEpoch := history[len(history)-2].Epoch
		prevAllocs, err1 := octant.GetAllocations(ctx, prevEpoch)
		if err1 == nil {
			prevDonors := make([]string, len(prevAllocs))
			prevAmounts := make([]float64, len(prevAllocs))
			prevProjects := make([]string, len(prevAllocs))
			for i, a := range prevAllocs {
				prevDonors[i] = a.Donor
				prevProjects[i] = a.Project
				prevAmounts[i] = weiToEth(a.Amount)
			}
			anomalies := analysis.DetectTemporalAnomalies(ad.donors, ad.amounts, ad.projects, prevDonors, prevAmounts, prevProjects, prevEpoch, epoch)
			for _, a := range anomalies {
				anomalyList = append(anomalyList, anomalyOut{a.Type, a.Severity, a.Description, a.EpochTo, a.Metric})
			}
		}
	}
	sse.sendStep(5, totalSteps, fmt.Sprintf("%d temporal anomalies detected", len(anomalyList)), map[string]any{"anomalies": anomalyList})

	// Step 6: Multi-layer scoring
	sse.sendStep(6, totalSteps, "Computing multi-layer scores...", nil)
	multiScores := analysis.ComputeMultiScores(metrics, trustProfiles)
	var projectScore *analysis.MultiScore
	for i, ms := range multiScores {
		if strings.EqualFold(ms.Address, address) {
			projectScore = &multiScores[i]
			break
		}
	}
	var scoresData map[string]any
	if projectScore != nil {
		scoresData = map[string]any{
			"fundingScore":     projectScore.FundingScore,
			"efficiencyScore":  projectScore.EfficiencyScore,
			"diversityScore":   projectScore.DiversityScore,
			"consistencyScore": projectScore.ConsistencyScore,
			"overallScore":     projectScore.OverallScore,
		}
	}
	sse.sendStep(6, totalSteps, fmt.Sprintf("Overall score: %.1f/100", func() float64 { if projectScore != nil { return projectScore.OverallScore }; return 0 }()), scoresData)

	// Step 7: Multi-chain blockchain scan
	sse.sendStep(7, totalSteps, fmt.Sprintf("Scanning address across %d EVM chains...", len(data.SupportedChains)), nil)
	bc := data.NewBlockchainClient()
	chainSignals := bc.ScanAddress(ctx, address)
	chainContext := ""
	var chainData map[string]any
	if chainSignals.TotalChainsActive > 0 {
		chainContext = chainSignals.FormatSignals()
		chainData = map[string]any{
			"totalChainsActive": chainSignals.TotalChainsActive,
			"totalBalance":      chainSignals.TotalBalance,
			"totalTxCount":      chainSignals.TotalTxCount,
			"totalTokens":       chainSignals.TotalTokens,
			"isMultichain":      chainSignals.IsMultichain,
			"hasContracts":      chainSignals.HasContracts,
			"hasStablecoins":    chainSignals.HasStablecoins,
			"chains":            chainSignals.Chains,
		}
	}
	sse.sendStep(7, totalSteps, fmt.Sprintf("Active on %d/%d chains", chainSignals.TotalChainsActive, len(chainSignals.Chains)), chainData)

	// Step 8: OSO signals
	osoMetrics := ""
	if osoName != "" {
		sse.sendStep(8, totalSteps, fmt.Sprintf("Collecting OSO signals (%s)...", osoName), nil)
		oso := data.NewOSOClient()
		signals := oso.CollectProjectSignals(ctx, osoName)
		osoMetrics = signals.FormatSignals()
		if osoMetrics == "No OSO data available for this project." {
			osoMetrics = ""
		}
		sse.sendStep(8, totalSteps, "OSO signals collected", map[string]any{"osoMetrics": osoMetrics})
	} else {
		sse.sendStep(8, totalSteps, "OSO signals skipped (no oso_name provided)", nil)
	}

	// Step 9: AI deep evaluation (evidence-grounded with ALL collected data)
	aiEvalText := ""
	aiModel := "N/A"
	aiProvider := "N/A"
	if !ai.HasProviders() {
		sse.sendStep(9, totalSteps, "AI evaluation skipped (no providers configured)", nil)
	} else {
		sse.sendStep(9, totalSteps, "Generating AI deep evaluation...", nil)

		var contextData strings.Builder
		contextData.WriteString(fmt.Sprintf("Project: %s\n", address))
		contextData.WriteString(fmt.Sprintf("Rank: %d/%d (Epoch %d) | Score: %.1f\n", projectRank, len(metrics), epoch, projectMetric.CompositeScore))
		if projectTrust != nil {
			contextData.WriteString(fmt.Sprintf("Trust: diversity=%.3f, whale_dep=%.1f%%, coord_risk=%.3f, repeat_donors=%d/%d\n",
				projectTrust.DonorDiversity, projectTrust.WhaleDepRatio*100, projectTrust.CoordinationRisk, projectTrust.RepeatDonors, projectTrust.UniqueDonors))
			for _, f := range projectTrust.Flags {
				contextData.WriteString(fmt.Sprintf("Trust flag: %s\n", f))
			}
		}
		cappedP := findProject(capped)
		equalP := findProject(equal)
		trustP := findProject(trustWeighted)
		if cappedP != nil && equalP != nil && trustP != nil {
			contextData.WriteString(fmt.Sprintf("Mechanism impact: Standard QF -> Capped QF %+.1f%%, Equal Weight %+.1f%%, Trust-Weighted %+.1f%%\n",
				cappedP.Change, equalP.Change, trustP.Change))
		}
		if len(anomalyList) > 0 {
			contextData.WriteString(fmt.Sprintf("\nTemporal anomalies detected (%d):\n", len(anomalyList)))
			for _, a := range anomalyList {
				contextData.WriteString(fmt.Sprintf("  [%s] %s: %s\n", a.Severity, a.Type, a.Description))
			}
		}
		if projectScore != nil {
			contextData.WriteString(fmt.Sprintf("\nMulti-layer scores: Funding=%.1f, Efficiency=%.1f, Diversity=%.1f, Consistency=%.1f, Overall=%.1f\n",
				projectScore.FundingScore, projectScore.EfficiencyScore, projectScore.DiversityScore, projectScore.ConsistencyScore, projectScore.OverallScore))
		}

		evalResult, err := analysis.DeepEvaluateProject(ctx, ai, address, history, osoMetrics+"\n\n"+chainContext+"\n\n"+contextData.String())
		if err != nil {
			sse.sendStep(9, totalSteps, fmt.Sprintf("AI evaluation failed: %v", err), nil)
		} else {
			aiEvalText = evalResult.Evaluation
			aiModel = evalResult.Model
			aiProvider = evalResult.Provider
			sse.sendStep(9, totalSteps, "AI deep evaluation complete", map[string]any{
				"evaluation": aiEvalText,
				"model":      aiModel,
				"provider":   aiProvider,
			})
		}
	}

	// Step 10: Adaptive signal collection (fill gaps)
	sse.sendStep(10, totalSteps, "Adaptive signal collection — assessing gaps...", nil)
	collectedSignals := &analysis.CollectedSignals{
		Address:       address,
		HasHistory:    len(history) > 0,
		HistoryEpochs: len(history),
		HasTrust:      projectTrust != nil,
		TrustProfile:  projectTrust,
		HasChainData:  chainSignals != nil,
		ChainSignals:  chainSignals,
		HasOSO:        osoMetrics != "",
		OSOMetrics:    osoMetrics,
		HasGitHub:     false,
		HasAnomalies:  len(anomalyList) > 0,
		AnomalyCount:  len(anomalyList),
		OSOName:       osoName,
	}
	adaptiveResult := analysis.AdaptiveCollect(ctx, collectedSignals, 2)
	var adaptiveData map[string]any
	if len(adaptiveResult.GapsFilled) > 0 || len(adaptiveResult.GapsRemaining) > 0 {
		adaptiveData = map[string]any{
			"iterations":    adaptiveResult.Iterations,
			"gapsDetected":  len(adaptiveResult.GapsDetected),
			"gapsFilled":    adaptiveResult.GapsFilled,
			"gapsRemaining": adaptiveResult.GapsRemaining,
		}
		// Update signals from adaptive collection
		if adaptiveResult.ExtraOSO != "" && osoMetrics == "" {
			osoMetrics = adaptiveResult.ExtraOSO
		}
	}
	// Collect community signals: Octant Discourse + Optimism RetroPGF
	discourse := data.NewOctantDiscourseClient()
	// Try to find a project name for discourse search — use OSO name or address
	discourseQuery := osoName
	if discourseQuery == "" && len(address) > 6 {
		discourseQuery = address
	}
	var communitySignals *data.CommunitySignals
	var crossEcosystem *data.CrossEcosystemPresence
	if discourseQuery != "" {
		communitySignals = discourse.CollectCommunitySignals(ctx, discourseQuery)
		retropgf := data.NewRetroPGFClient()
		crossEcosystem = retropgf.FindInRetroPGF(ctx, discourseQuery, address, "")
	}

	if adaptiveData == nil {
		adaptiveData = map[string]any{}
	}
	if communitySignals != nil && communitySignals.TopicsFound > 0 {
		adaptiveData["discourse"] = map[string]any{
			"topicsFound":   communitySignals.TopicsFound,
			"totalPosts":    communitySignals.TotalPosts,
			"totalLikes":    communitySignals.TotalLikes,
			"uniqueAuthors": communitySignals.UniqueAuthors,
			"topTopics":     communitySignals.TopTopics,
		}
	}
	if crossEcosystem != nil && crossEcosystem.InRetroPGF {
		adaptiveData["retroPGF"] = map[string]any{
			"found":      true,
			"name":       crossEcosystem.RetroPGFProject.DisplayName,
			"categories": crossEcosystem.RetroPGFCategories,
			"funding":    crossEcosystem.RetroPGFFunding,
		}
	}

	discourseInfo := ""
	if communitySignals != nil && communitySignals.TopicsFound > 0 {
		discourseInfo = fmt.Sprintf(", discourse: %d topics", communitySignals.TopicsFound)
	}
	retroInfo := ""
	if crossEcosystem != nil && crossEcosystem.InRetroPGF {
		retroInfo = ", RetroPGF: found"
	}
	sse.sendStep(10, totalSteps, fmt.Sprintf("Adaptive collection: %d gaps filled, %d remaining%s%s",
		len(adaptiveResult.GapsFilled), len(adaptiveResult.GapsRemaining), discourseInfo, retroInfo), adaptiveData)

	// Step 11: Signal reliability assessment
	sse.sendStep(11, totalSteps, "Assessing signal reliability...", nil)
	reliabilityReport := analysis.AssessReliability(
		projectTrust, chainSignals, osoMetrics, history,
		collectedSignals.HasGitHub, len(anomalyList),
	)
	var reliabilityData map[string]any
	if reliabilityReport != nil {
		reliabilityData = map[string]any{
			"overallScore":     reliabilityReport.OverallScore,
			"dataCompleteness": reliabilityReport.DataCompleteness,
			"highCount":        reliabilityReport.HighCount,
			"mediumCount":      reliabilityReport.MediumCount,
			"lowCount":         reliabilityReport.LowCount,
			"signals":          reliabilityReport.Signals,
		}
	}
	// Compute data freshness, signal corroboration, and donor profiling (embedded in step 11)
	freshnessReport := analysis.BuildFreshnessReport(history, chainSignals, "", "", nil)
	corroborationReport := analysis.CrossVerifySignals(projectTrust, chainSignals, nil, nil, history)
	donorReport := analysis.BuildDonorProfiles(ad.projects, ad.amounts, ad.donors, ad.prevDonors)

	if reliabilityData == nil {
		reliabilityData = map[string]any{}
	}
	if freshnessReport != nil {
		reliabilityData["freshness"] = map[string]any{
			"realtimeCount": freshnessReport.RealtimeCount,
			"staleCount":    freshnessReport.StaleCount,
			"oldestSignal":  freshnessReport.OldestSignal,
			"newestSignal":  freshnessReport.NewestSignal,
		}
	}
	if corroborationReport != nil {
		reliabilityData["corroboration"] = map[string]any{
			"trustScore":     corroborationReport.TrustScore,
			"confirmedCount": corroborationReport.ConfirmedCount,
			"conflictCount":  corroborationReport.ConflictCount,
			"checks":         corroborationReport.Checks,
		}
	}
	if donorReport != nil {
		reliabilityData["donorProfiling"] = map[string]any{
			"totalDonors":       donorReport.TotalDonors,
			"diversifiedCount":  donorReport.DiversifiedCount,
			"focusedCount":      donorReport.FocusedCount,
			"whaleCount":        donorReport.WhaleCount,
			"sybilRiskCount":    donorReport.SybilRiskCount,
			"repeatDonorPct":    donorReport.RepeatDonorPct,
			"top10DonorShare":   donorReport.Top10DonorShare,
			"avgProjectsPerDonor": donorReport.AvgProjectsPerDonor,
		}
	}

	sse.sendStep(11, totalSteps, fmt.Sprintf("Reliability: %.0f/100 | Corroboration: %.0f/100 | Donors: %d profiled",
		reliabilityReport.OverallScore, corroborationReport.TrustScore, donorReport.TotalDonors), reliabilityData)

	// Generate PDF report (AFTER AI evaluation so we have the text)
	var reportPath string
	if projectTrust != nil {
		shortAddr := address
		if len(shortAddr) > 14 {
			shortAddr = shortAddr[:8] + "..." + shortAddr[len(shortAddr)-4:]
		}
		mechRows := [][]string{}
		for _, mi := range mechImpacts {
			mechRows = append(mechRows, []string{mi.Name, fmt.Sprintf("%.4f ETH", mi.Allocated), fmt.Sprintf("%+.1f%%", mi.Change)})
		}
		histRows := [][]string{}
		for _, h := range histOut {
			histRows = append(histRows, []string{fmt.Sprintf("%d", h.Epoch), fmt.Sprintf("%.4f", h.Allocated), fmt.Sprintf("%.4f", h.Matched), fmt.Sprintf("%d", h.Donors)})
		}
		// Build anomaly text for PDF
		anomalyText := ""
		if len(anomalyList) > 0 {
			anomalyText = fmt.Sprintf("Temporal Anomalies Detected: %d\n\n", len(anomalyList))
			for _, a := range anomalyList {
				anomalyText += fmt.Sprintf("- [%s] %s: %s\n", strings.ToUpper(a.Severity), a.Type, a.Description)
			}
		}
		// Build scores text for PDF
		scoresText := ""
		if projectScore != nil {
			scoresText = fmt.Sprintf("Funding: %.1f/100 | Efficiency: %.1f/100 | Diversity: %.1f/100 | Consistency: %.1f/100 | Overall: %.1f/100",
				projectScore.FundingScore, projectScore.EfficiencyScore, projectScore.DiversityScore, projectScore.ConsistencyScore, projectScore.OverallScore)
		}

		sections := []report.PDFSection{
			{Heading: "Funding History", Table: &report.PDFTable{Headers: []string{"Epoch", "Allocated (ETH)", "Matched (ETH)", "Donors"}, Rows: histRows, ColW: []float64{25, 45, 45, 30}}},
			{Heading: "Trust Profile", Body: fmt.Sprintf("Unique Donors: %d\nDonor Diversity (Shannon): %.3f\nWhale Dependency: %.1f%%\nCoordination Risk (Jaccard): %.3f\nRepeat Donors: %d", projectTrust.UniqueDonors, projectTrust.DonorDiversity, projectTrust.WhaleDepRatio*100, projectTrust.CoordinationRisk, projectTrust.RepeatDonors)},
			{Heading: "Multi-Layer Scores", Body: scoresText},
			{Heading: "Mechanism Simulation Impact", Table: &report.PDFTable{Headers: []string{"Mechanism", "Allocated", "Change"}, Rows: mechRows, ColW: []float64{70, 50, 40}}},
		}
		if anomalyText != "" {
			sections = append(sections, report.PDFSection{Heading: "Temporal Anomalies", Body: anomalyText})
		}
		if chainContext != "" {
			sections = append(sections, report.PDFSection{Heading: "Multi-Chain Blockchain Activity", Body: chainContext})
		}
		// Signal Reliability section
		reliabilityText := analysis.FormatReliabilityReport(reliabilityReport)
		if reliabilityText != "" {
			sections = append(sections, report.PDFSection{Heading: "Signal Reliability Assessment", Body: reliabilityText})
		}
		// Adaptive Collection section
		adaptiveText := analysis.FormatAdaptiveResult(adaptiveResult)
		if adaptiveText != "" {
			sections = append(sections, report.PDFSection{Heading: "Adaptive Signal Collection", Body: adaptiveText})
		}
		// Data Freshness section
		freshnessText := analysis.FormatFreshnessReport(freshnessReport)
		if freshnessText != "" {
			sections = append(sections, report.PDFSection{Heading: "Data Freshness Assessment", Body: freshnessText})
		}
		// Signal Corroboration section
		corroborationText := analysis.FormatCorroborationReport(corroborationReport)
		if corroborationText != "" {
			sections = append(sections, report.PDFSection{Heading: "Signal Corroboration", Body: corroborationText})
		}
		// Donor Profiling section
		donorText := analysis.FormatDonorProfileReport(donorReport)
		if donorText != "" {
			sections = append(sections, report.PDFSection{Heading: "Donor Behavior Profiling", Body: donorText})
		}
		// Community Signals (Discourse)
		if communitySignals != nil && communitySignals.TopicsFound > 0 {
			sections = append(sections, report.PDFSection{Heading: "Community Signals (Octant Discourse)", Body: communitySignals.FormatCommunitySignals()})
		}
		// Cross-Ecosystem Validation (RetroPGF)
		crossEcoText := data.FormatCrossEcosystem(crossEcosystem)
		if crossEcoText != "" {
			sections = append(sections, report.PDFSection{Heading: "Cross-Ecosystem Validation", Body: crossEcoText})
		}
		if aiEvalText != "" {
			sections = append(sections, report.PDFSection{Heading: "AI Deep Evaluation", Body: aiEvalText})
		}

		pdfReport := &report.PDFReport{
			Title:    fmt.Sprintf("Intelligence Report: %s", shortAddr),
			Subtitle: fmt.Sprintf("Octant Public Goods Evaluation | Epoch %d", epoch),
			Model:    aiModel,
			Provider: aiProvider,
			Metadata: map[string]string{
				"Address":          address,
				"Rank":             fmt.Sprintf("%d / %d projects", projectRank, len(metrics)),
				"Composite Score":  fmt.Sprintf("%.1f / 100", projectMetric.CompositeScore),
				"Overall Score":    fmt.Sprintf("%.1f / 100", func() float64 { if projectScore != nil { return projectScore.OverallScore }; return 0 }()),
				"Donor Diversity":  fmt.Sprintf("%.3f (Shannon entropy)", projectTrust.DonorDiversity),
				"Whale Dependency": fmt.Sprintf("%.1f%%", projectTrust.WhaleDepRatio*100),
				"AI Model":         aiModel,
			},
			Sections: sections,
		}
		if p, err := report.GeneratePDF(pdfReport); err == nil {
			reportPath = p
		}
	}

	// Final aggregated result
	finalResult := map[string]any{
		"address":       address,
		"epoch":         epoch,
		"rank":          projectRank,
		"totalProjects": len(metrics),
		"quantitative": map[string]any{
			"allocated":      projectMetric.Allocated,
			"matched":        projectMetric.Matched,
			"totalFunding":   projectMetric.TotalFunding,
			"compositeScore": projectMetric.CompositeScore,
			"cluster":        projectMetric.Cluster,
		},
		"trust":            trustData,
		"history":          histOut,
		"mechanismImpacts": mechImpacts,
		"anomalies":        anomalyList,
		"scores":           scoresData,
		"blockchain":       chainData,
		"reliability":        reliabilityData,
		"adaptiveCollection": adaptiveData,
		"donorProfiling": map[string]any{
			"totalDonors":      donorReport.TotalDonors,
			"diversifiedCount": donorReport.DiversifiedCount,
			"whaleCount":       donorReport.WhaleCount,
			"sybilRiskCount":   donorReport.SybilRiskCount,
			"top10DonorShare":  donorReport.Top10DonorShare,
		},
		"reportPath": reportPath,
	}
	sse.sendDone(finalResult)
}

// handleTrustGraphStream streams trust computation with optional AI narrative via SSE.
// GET /api/trust-graph/stream?epoch=5
func handleTrustGraphStream(w http.ResponseWriter, r *http.Request) {
	sse := newSSEWriter(w)
	if sse == nil {
		return
	}

	epoch := parseEpoch(r)
	if epoch == 0 {
		sse.sendError("epoch query parameter is required")
		return
	}

	ctx := r.Context()
	octant := data.NewOctantClient()

	// Step 1: Fetch allocations
	sse.sendStep(1, 3, "Fetching allocation data...", nil)
	ad, err := collectAllocData(ctx, octant, epoch)
	if err != nil {
		sse.sendError(fmt.Sprintf("failed to get allocations: %v", err))
		return
	}
	if len(ad.allocations) == 0 {
		sse.sendStep(1, 3, "No allocations found", nil)
		sse.sendDone(map[string]any{"epoch": epoch, "profiles": []any{}})
		return
	}
	sse.sendStep(1, 3, fmt.Sprintf("Found %d allocations", len(ad.allocations)), nil)

	// Step 2: Build trust profiles
	sse.sendStep(2, 3, "Computing trust profiles...", nil)
	profiles := analysis.BuildTrustProfiles(ad.projects, ad.amounts, ad.donors, ad.prevDonors)

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
		out[i] = trustJSON{p.Address, p.DonorCount, p.UniqueDonors, p.DonorDiversity, p.WhaleDepRatio, p.CoordinationRisk, p.RepeatDonors, flags}
	}
	sse.sendStep(2, 3, fmt.Sprintf("Computed %d trust profiles", len(profiles)), map[string]any{"profiles": out})

	// Step 3: AI narrative summary
	ai := provider.New()
	if ai.HasProviders() {
		sse.sendStep(3, 3, "Generating AI trust narrative...", nil)

		var summary strings.Builder
		summary.WriteString(fmt.Sprintf("Epoch %d trust analysis: %d projects, %d allocations.\n", epoch, len(profiles), len(ad.allocations)))
		flagged := 0
		for _, p := range profiles {
			if len(p.Flags) > 0 {
				flagged++
				addr := p.Address
				if len(addr) > 10 {
					addr = addr[:10] + "..."
				}
				summary.WriteString(fmt.Sprintf("- %s: flags=%v, diversity=%.3f, whale=%.1f%%\n",
					addr, p.Flags, p.DonorDiversity, p.WhaleDepRatio*100))
			}
		}
		summary.WriteString(fmt.Sprintf("Total flagged: %d/%d projects.\n", flagged, len(profiles)))

		prompt := fmt.Sprintf("Analyze this Octant trust graph summary and provide a brief narrative (3-5 sentences) about the health of the funding ecosystem:\n\n%s", summary.String())
		resp, err := ai.Complete(ctx, prompt, "You are a public goods funding analyst.")
		if err != nil {
			sse.sendStep(3, 3, "AI narrative generation failed", map[string]any{"error": err.Error()})
		} else {
			sse.sendStep(3, 3, "AI narrative complete", map[string]any{"narrative": resp.Text})
		}
	} else {
		sse.sendStep(3, 3, "AI narrative skipped (no providers)", nil)
	}

	sse.sendDone(map[string]any{"epoch": epoch, "profiles": out})
}

// handleSimulateStream streams mechanism comparison with optional AI analysis via SSE.
// GET /api/simulate/stream?epoch=5
func handleSimulateStream(w http.ResponseWriter, r *http.Request) {
	sse := newSSEWriter(w)
	if sse == nil {
		return
	}

	epoch := parseEpoch(r)
	if epoch == 0 {
		sse.sendError("epoch query parameter is required")
		return
	}

	ctx := r.Context()
	octant := data.NewOctantClient()

	// Step 1: Fetch data
	sse.sendStep(1, 4, "Fetching allocation data...", nil)
	ad, err := collectAllocData(ctx, octant, epoch)
	if err != nil {
		sse.sendError(fmt.Sprintf("failed to get allocations: %v", err))
		return
	}
	if len(ad.allocations) == 0 {
		sse.sendStep(1, 4, "No allocations found", nil)
		sse.sendDone(map[string]any{"epoch": epoch, "mechanisms": []any{}})
		return
	}
	sse.sendStep(1, 4, fmt.Sprintf("Found %d allocations", len(ad.allocations)), nil)

	// Step 2: Build trust scores
	sse.sendStep(2, 4, "Building trust scores...", nil)
	inputs := make([]analysis.AllocationInput, len(ad.allocations))
	for i, a := range ad.allocations {
		inputs[i] = analysis.AllocationInput{Donor: a.Donor, Project: a.Project, Amount: ad.amounts[i]}
	}

	trustProfiles := analysis.BuildTrustProfiles(ad.projects, ad.amounts, ad.donors, nil)
	trustScores := map[string]float64{}
	for _, tp := range trustProfiles {
		trustScores[tp.Address] = tp.DonorDiversity
	}
	sse.sendStep(2, 4, "Trust scores computed", nil)

	// Step 3: Run simulations
	sse.sendStep(3, 4, "Running mechanism simulations...", nil)
	originalMech := analysis.SimulateStandardQF(inputs)
	originalMech.Name = "Original (Standard QF)"
	cappedMech := analysis.SimulateCappedQF(inputs, 0.10)
	equalMech := analysis.SimulateEqualWeight(inputs)
	trustMech := analysis.SimulateTrustWeightedQF(inputs, trustScores)

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

	mechanisms := []any{
		marshalMech(originalMech),
		marshalMech(cappedMech),
		marshalMech(equalMech),
		marshalMech(trustMech),
	}
	sse.sendStep(3, 4, "Simulations complete", map[string]any{"mechanisms": mechanisms})

	// Step 4: AI comparison analysis
	ai := provider.New()
	if ai.HasProviders() {
		sse.sendStep(4, 4, "Generating AI mechanism comparison...", nil)

		var comparison strings.Builder
		comparison.WriteString(fmt.Sprintf("Epoch %d mechanism simulation results:\n", epoch))
		for _, mech := range []analysis.MechanismResult{originalMech, cappedMech, equalMech, trustMech} {
			comparison.WriteString(fmt.Sprintf("- %s: Gini=%.4f, Top5%%=%.1f%%, AboveThreshold=%d\n",
				mech.Name, mech.GiniCoeff, mech.TopShare*100, mech.AboveThreshold))
		}

		prompt := fmt.Sprintf("Compare these quadratic funding mechanism simulations and recommend which would be fairest for public goods funding. Be concise (4-6 sentences):\n\n%s", comparison.String())
		resp, err := ai.Complete(ctx, prompt, "You are a public goods funding mechanism designer.")
		if err != nil {
			sse.sendStep(4, 4, "AI comparison failed", map[string]any{"error": err.Error()})
		} else {
			sse.sendStep(4, 4, "AI comparison complete", map[string]any{"analysis": resp.Text})
		}
	} else {
		sse.sendStep(4, 4, "AI comparison skipped (no providers)", nil)
	}

	sse.sendDone(map[string]any{"epoch": epoch, "mechanisms": mechanisms})
}

// handleReportEpochStream streams full epoch report generation via SSE.
// GET /api/report-epoch/stream?epoch=5
func handleReportEpochStream(w http.ResponseWriter, r *http.Request) {
	sse := newSSEWriter(w)
	if sse == nil {
		return
	}

	epoch := parseEpoch(r)
	if epoch == 0 {
		sse.sendError("epoch query parameter is required")
		return
	}

	ctx := r.Context()
	octant := data.NewOctantClient()

	// Step 1: Quantitative analysis
	sse.sendStep(1, 4, "Running quantitative analysis...", nil)
	rewards, err := octant.GetProjectRewards(ctx, epoch)
	if err != nil {
		sse.sendError(fmt.Sprintf("failed to get rewards: %v", err))
		return
	}
	if len(rewards) == 0 {
		sse.sendError("no rewards found for this epoch")
		return
	}

	metrics := make([]analysis.ProjectMetrics, len(rewards))
	for i, rw := range rewards {
		alloc := analysis.WeiToEth(rw.Allocated)
		matched := analysis.WeiToEth(rw.Matched)
		metrics[i] = analysis.ProjectMetrics{
			Address:      rw.Address,
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
		Address string  `json:"address"`
		Alloc   float64 `json:"allocated"`
		Matched float64 `json:"matched"`
		Score   float64 `json:"score"`
		Cluster int     `json:"cluster"`
		Rank    int     `json:"rank"`
	}
	quantOut := make([]projectResult, len(metrics))
	for i, m := range metrics {
		quantOut[i] = projectResult{m.Address, m.Allocated, m.Matched, m.CompositeScore, m.Cluster, i + 1}
	}
	sse.sendStep(1, 4, fmt.Sprintf("Quantitative analysis complete (%d projects)", len(metrics)), map[string]any{"rankings": quantOut})

	// Step 2: Anomaly detection
	sse.sendStep(2, 4, "Detecting anomalies...", nil)
	ad, err := collectAllocData(ctx, octant, epoch)
	if err != nil {
		sse.sendError(fmt.Sprintf("failed to get allocations: %v", err))
		return
	}

	anomalyReport := analysis.DetectAnomalies(ad.donors, ad.amounts)
	anomalyData := map[string]any{
		"totalDonations":     anomalyReport.TotalDonations,
		"uniqueDonors":       anomalyReport.UniqueDonors,
		"totalAmount":        anomalyReport.TotalAmount,
		"meanDonation":       anomalyReport.MeanDonation,
		"medianDonation":     anomalyReport.MedianDonation,
		"maxDonation":        anomalyReport.MaxDonation,
		"whaleConcentration": anomalyReport.WhaleConcentration,
		"flags":              anomalyReport.Flags,
	}
	sse.sendStep(2, 4, "Anomaly detection complete", anomalyData)

	// Step 3: Trust graph
	sse.sendStep(3, 4, "Building trust graph...", nil)
	trustProfiles := analysis.BuildTrustProfiles(ad.projects, ad.amounts, ad.donors, ad.prevDonors)

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
	trustOut := make([]trustJSON, len(trustProfiles))
	for i, p := range trustProfiles {
		flags := p.Flags
		if flags == nil {
			flags = []string{}
		}
		trustOut[i] = trustJSON{p.Address, p.DonorCount, p.UniqueDonors, p.DonorDiversity, p.WhaleDepRatio, p.CoordinationRisk, p.RepeatDonors, flags}
	}
	sse.sendStep(3, 4, fmt.Sprintf("Trust graph built (%d profiles)", len(trustProfiles)), map[string]any{"profiles": trustOut})

	// Step 4: Mechanism simulation
	sse.sendStep(4, 4, "Simulating mechanisms...", nil)
	inputs := make([]analysis.AllocationInput, len(ad.allocations))
	for i, a := range ad.allocations {
		inputs[i] = analysis.AllocationInput{Donor: a.Donor, Project: a.Project, Amount: ad.amounts[i]}
	}
	originalMech := analysis.SimulateStandardQF(inputs)
	originalMech.Name = "Original (Standard QF)"
	cappedMech := analysis.SimulateCappedQF(inputs, 0.10)
	equalMech := analysis.SimulateEqualWeight(inputs)

	mechSummary := func(m analysis.MechanismResult) map[string]any {
		return map[string]any{
			"name":           m.Name,
			"giniCoeff":      m.GiniCoeff,
			"topShare":       m.TopShare,
			"aboveThreshold": m.AboveThreshold,
		}
	}
	mechData := []any{mechSummary(originalMech), mechSummary(cappedMech), mechSummary(equalMech)}
	sse.sendStep(4, 4, "Mechanism simulations complete", map[string]any{"mechanisms": mechData})

	// Done - full report
	sse.sendDone(map[string]any{
		"epoch":      epoch,
		"rankings":   quantOut,
		"anomalies":  anomalyData,
		"trust":      trustOut,
		"mechanisms": mechData,
	})
}

// handleTrackProject returns cross-epoch timeline, temporal anomalies, and multi-layer scores.
func handleScanChain(w http.ResponseWriter, r *http.Request) {
	address := r.URL.Query().Get("address")
	if address == "" {
		jsonError(w, "address query parameter is required", http.StatusBadRequest)
		return
	}
	bc := data.NewBlockchainClient()
	signals := bc.ScanAddress(r.Context(), address)
	jsonOK(w, signals)
}

func handleTrackProject(w http.ResponseWriter, r *http.Request) {
	address := r.URL.Query().Get("address")
	if address == "" {
		jsonError(w, "address query parameter is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	octant := data.NewOctantClient()

	// Fetch current epoch
	ep, err := octant.GetCurrentEpoch(ctx)
	if err != nil {
		jsonError(w, fmt.Sprintf("failed to get current epoch: %v", err), http.StatusInternalServerError)
		return
	}

	// Fetch history
	history, err := octant.GetProjectHistory(ctx, address, 1, ep.CurrentEpoch)
	if err != nil {
		jsonError(w, fmt.Sprintf("failed to get project history: %v", err), http.StatusInternalServerError)
		return
	}

	if len(history) == 0 {
		jsonOK(w, map[string]any{"timeline": []any{}, "anomalies": []any{}, "scores": nil, "error": "project not found in any epoch"})
		return
	}

	// Build timeline
	type timelineEntry struct {
		Epoch     int     `json:"epoch"`
		Allocated float64 `json:"allocated"`
		Matched   float64 `json:"matched"`
		Donors    int     `json:"donors"`
	}
	timeline := make([]timelineEntry, len(history))
	for i, h := range history {
		timeline[i] = timelineEntry{h.Epoch, h.Allocated, h.Matched, h.Donors}
	}

	// Temporal anomalies (compare last 2 epochs)
	var anomalies []analysis.TemporalAnomaly
	latestEpoch := history[len(history)-1].Epoch

	if len(history) >= 2 {
		prevEpoch := history[len(history)-2].Epoch
		prevAllocs, err1 := octant.GetAllocations(ctx, prevEpoch)
		currAllocs, err2 := octant.GetAllocations(ctx, latestEpoch)
		if err1 == nil && err2 == nil {
			prevDonors := make([]string, len(prevAllocs))
			prevAmounts := make([]float64, len(prevAllocs))
			prevProjects := make([]string, len(prevAllocs))
			for i, a := range prevAllocs {
				prevDonors[i] = a.Donor
				prevProjects[i] = a.Project
				prevAmounts[i] = weiToEth(a.Amount)
			}
			currDonors := make([]string, len(currAllocs))
			currAmounts := make([]float64, len(currAllocs))
			currProjects := make([]string, len(currAllocs))
			for i, a := range currAllocs {
				currDonors[i] = a.Donor
				currProjects[i] = a.Project
				currAmounts[i] = weiToEth(a.Amount)
			}
			anomalies = analysis.DetectTemporalAnomalies(currDonors, currAmounts, currProjects, prevDonors, prevAmounts, prevProjects, prevEpoch, latestEpoch)
		}
	}

	type anomalyOut struct {
		Type        string  `json:"type"`
		Severity    string  `json:"severity"`
		Description string  `json:"description"`
		Epoch       int     `json:"epoch"`
		Metric      float64 `json:"metric"`
	}
	anomalyList := make([]anomalyOut, 0)
	for _, a := range anomalies {
		anomalyList = append(anomalyList, anomalyOut{a.Type, a.Severity, a.Description, a.EpochTo, a.Metric})
	}

	// Multi-layer scoring
	rewards, err := octant.GetProjectRewards(ctx, latestEpoch)
	var scores *analysis.MultiScore
	if err == nil {
		metrics := make([]analysis.ProjectMetrics, len(rewards))
		for i, rw := range rewards {
			alloc := analysis.WeiToEth(rw.Allocated)
			matched := analysis.WeiToEth(rw.Matched)
			metrics[i] = analysis.ProjectMetrics{
				Address:      rw.Address,
				Allocated:    alloc,
				Matched:      matched,
				TotalFunding: alloc + matched,
			}
		}

		// Build trust profiles for diversity score
		allocs, _ := octant.GetAllocations(ctx, latestEpoch)
		var trustProfiles []analysis.TrustProfile
		if allocs != nil {
			projects := make([]string, len(allocs))
			donors := make([]string, len(allocs))
			amounts := make([]float64, len(allocs))
			for i, a := range allocs {
				projects[i] = a.Project
				donors[i] = a.Donor
				amounts[i] = weiToEth(a.Amount)
			}
			trustProfiles = analysis.BuildTrustProfiles(projects, amounts, donors, nil)
		}

		multiScores := analysis.ComputeMultiScores(metrics, trustProfiles)
		for _, ms := range multiScores {
			if strings.EqualFold(ms.Address, address) {
				scores = &ms
				break
			}
		}
	}

	result := map[string]any{
		"address":   address,
		"timeline":  timeline,
		"anomalies": anomalyList,
	}
	if scores != nil {
		result["scores"] = map[string]any{
			"fundingScore":     scores.FundingScore,
			"efficiencyScore":  scores.EfficiencyScore,
			"diversityScore":   scores.DiversityScore,
			"consistencyScore": scores.ConsistencyScore,
			"overallScore":     scores.OverallScore,
		}
	}
	jsonOK(w, result)
}

// --- Chat Agent ---

const chatSystemPrompt = `You are Tessera, an AI agent for Ethereum public goods evaluation. Answer based on the data provided below. Be concise and technical. For format:json, respond in JSON.`

// chatDetectIntent uses keyword matching to detect if user wants to run a command.
func chatDetectIntent(msg string) (cmd string, epoch int, addr string) {
	lower := strings.ToLower(msg)
	epoch = 5
	for e := 1; e <= 10; e++ {
		if strings.Contains(lower, fmt.Sprintf("epoch %d", e)) || strings.Contains(lower, fmt.Sprintf("epoch%d", e)) {
			epoch = e
			break
		}
	}
	for _, word := range strings.Fields(msg) {
		if strings.HasPrefix(word, "0x") && len(word) >= 10 {
			addr = word
			break
		}
	}
	switch {
	case strings.Contains(lower, "analyze epoch") || strings.Contains(lower, "epoch analysis") || strings.Contains(lower, "ranking") || strings.Contains(lower, "top project") || strings.Contains(lower, "highest") || strings.Contains(lower, "list project"):
		cmd = "analyze-epoch"
	case strings.Contains(lower, "anomal") || strings.Contains(lower, "whale") || strings.Contains(lower, "detect"):
		cmd = "detect-anomalies"
	case strings.Contains(lower, "trust") || strings.Contains(lower, "donor") || strings.Contains(lower, "entropy") || strings.Contains(lower, "jaccard") || strings.Contains(lower, "diversity"):
		cmd = "trust-graph"
	case strings.Contains(lower, "simulat") || strings.Contains(lower, "mechanism") || strings.Contains(lower, "quadratic") || strings.Contains(lower, "qf"):
		cmd = "simulate"
	case strings.Contains(lower, "analyze project") || strings.Contains(lower, "analyze-project") || strings.Contains(lower, "full intelligence") || strings.Contains(lower, "full analysis"):
		if addr != "" {
			cmd = "analyze-project"
		}
	case strings.Contains(lower, "evaluate") || strings.Contains(lower, "evaluation"):
		cmd = "evaluate"
	case (strings.Contains(lower, "scan") && strings.Contains(lower, "chain")) || strings.Contains(lower, "blockchain") || strings.Contains(lower, "balance"):
		if addr != "" {
			cmd = "scan-chain"
		}
	case strings.Contains(lower, "track") && addr != "":
		cmd = "track-project"
	}
	return
}

// chatExtractEvalParams extracts project name and description from natural language for evaluate command.
func chatExtractEvalParams(msg string) (name, desc, github string) {
	// Try to find quoted strings for name
	parts := strings.SplitN(msg, "\"", 5)
	if len(parts) >= 3 {
		name = parts[1]
		if len(parts) >= 5 {
			desc = parts[3]
		}
	}
	// Find GitHub URL
	for _, word := range strings.Fields(msg) {
		if strings.Contains(word, "github.com/") {
			github = word
			break
		}
	}
	return
}

func chatFetchData(ctx context.Context, cmd string, epoch int, addr string, userMsg string) (string, string, error) {
	octant := data.NewOctantClient()
	switch cmd {
	case "analyze-epoch":
		rewards, err := octant.GetProjectRewards(ctx, epoch)
		if err != nil {
			return "", "", err
		}
		metrics := make([]analysis.ProjectMetrics, len(rewards))
		for i, r := range rewards {
			alloc := analysis.WeiToEth(r.Allocated)
			matched := analysis.WeiToEth(r.Matched)
			metrics[i] = analysis.ProjectMetrics{Address: r.Address, Allocated: alloc, Matched: matched, TotalFunding: alloc + matched}
		}
		metrics = analysis.ComputeCompositeScores(metrics)
		sort.Slice(metrics, func(i, j int) bool { return metrics[i].CompositeScore > metrics[j].CompositeScore })
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("Epoch %d Analysis (%d projects):\n", epoch, len(metrics)))
		sb.WriteString("Rank | Address | Allocated ETH | Matched ETH | Score\n")
		for i, m := range metrics {
			sb.WriteString(fmt.Sprintf("%d | %s | %.4f | %.4f | %.1f\n", i+1, m.Address, m.Allocated, m.Matched, m.CompositeScore))
			if i >= 14 {
				sb.WriteString(fmt.Sprintf("... and %d more\n", len(metrics)-15))
				break
			}
		}
		return sb.String(), "", nil
	case "detect-anomalies":
		allocs, err := octant.GetAllocations(ctx, epoch)
		if err != nil {
			return "", "", err
		}
		donors := make([]string, len(allocs))
		amounts := make([]float64, len(allocs))
		for i, a := range allocs {
			donors[i] = a.Donor
			amounts[i] = analysis.WeiToEth(a.Amount)
		}
		report := analysis.DetectAnomalies(donors, amounts)
		return fmt.Sprintf("Anomaly Report Epoch %d:\nDonations: %d, Unique donors: %d\nTotal: %.4f ETH, Whale concentration: %.1f%%\nMean: %.6f, Median: %.6f, Max: %.4f\nFlags: %v",
			epoch, report.TotalDonations, report.UniqueDonors, report.TotalAmount,
			report.WhaleConcentration*100, report.MeanDonation, report.MedianDonation, report.MaxDonation, report.Flags), "", nil
	case "trust-graph":
		allocs, err := octant.GetAllocations(ctx, epoch)
		if err != nil {
			return "", "", err
		}
		projects := make([]string, len(allocs))
		tgDonors := make([]string, len(allocs))
		tgAmounts := make([]float64, len(allocs))
		for i, a := range allocs {
			projects[i] = a.Project
			tgDonors[i] = a.Donor
			tgAmounts[i] = weiToEth(a.Amount)
		}
		profiles := analysis.BuildTrustProfiles(projects, tgAmounts, tgDonors, nil)
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("Trust Graph Epoch %d (%d projects):\n", epoch, len(profiles)))
		sb.WriteString("Address | Donors | Diversity | WhaleDep | CoordRisk | Flags\n")
		for _, p := range profiles {
			sb.WriteString(fmt.Sprintf("%s | %d | %.3f | %.3f | %.3f | %v\n",
				p.Address, p.UniqueDonors, p.DonorDiversity, p.WhaleDepRatio, p.CoordinationRisk, p.Flags))
		}
		return sb.String(), "", nil
	case "simulate":
		allocs, err := octant.GetAllocations(ctx, epoch)
		if err != nil {
			return "", "", err
		}
		simProjects := make([]string, len(allocs))
		simDonors := make([]string, len(allocs))
		simAmounts := make([]float64, len(allocs))
		simInputs := make([]analysis.AllocationInput, len(allocs))
		for i, a := range allocs {
			eth := weiToEth(a.Amount)
			simProjects[i] = a.Project
			simDonors[i] = a.Donor
			simAmounts[i] = eth
			simInputs[i] = analysis.AllocationInput{Donor: a.Donor, Project: a.Project, Amount: eth}
		}
		trustProfiles := analysis.BuildTrustProfiles(simProjects, simAmounts, simDonors, nil)
		trustScores := map[string]float64{}
		for _, tp := range trustProfiles {
			trustScores[tp.Address] = tp.DonorDiversity
		}
		original := analysis.SimulateStandardQF(simInputs)
		capped := analysis.SimulateCappedQF(simInputs, 0.10)
		equal := analysis.SimulateEqualWeight(simInputs)
		trustWeighted := analysis.SimulateTrustWeightedQF(simInputs, trustScores)
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("Mechanism Simulation Epoch %d:\n", epoch))
		for _, m := range []analysis.MechanismResult{original, capped, equal, trustWeighted} {
			sb.WriteString(fmt.Sprintf("%s: Gini=%.3f, TopShare=%.1f%%, AboveThreshold=%d\n",
				m.Name, m.GiniCoeff, m.TopShare*100, m.AboveThreshold))
		}
		return sb.String(), "", nil
	case "scan-chain":
		if addr == "" {
			return "", "", fmt.Errorf("address required")
		}
		bc := data.NewBlockchainClient()
		signals := bc.ScanAddress(ctx, addr)
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("Blockchain Scan %s:\nActive chains: %d, Balance: %.6f, Txs: %d, Multichain: %v\n",
			signals.Address, signals.TotalChainsActive, signals.TotalBalance, signals.TotalTxCount, signals.IsMultichain))
		for _, c := range signals.Chains {
			if c.Error == "" && (c.Balance > 0 || c.TxCount > 0) {
				sb.WriteString(fmt.Sprintf("%s: %.6f %s, %d txs\n", c.Chain, c.Balance, c.NativeToken, c.TxCount))
			}
		}
		return sb.String(), "", nil
	case "track-project":
		if addr == "" {
			return "", "", fmt.Errorf("address required")
		}
		history, err := octant.GetProjectHistory(ctx, addr, 1, 10)
		if err != nil {
			return "", "", err
		}
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("Project %s history:\n", addr))
		for _, h := range history {
			sb.WriteString(fmt.Sprintf("E%d: %.4f alloc, %.4f matched, %d donors\n", h.Epoch, h.Allocated, h.Matched, h.Donors))
		}
		return sb.String(), "", nil
	case "evaluate":
		name, desc, githubURL := chatExtractEvalParams(userMsg)
		if name == "" || desc == "" {
			return "To evaluate a project, use this format:\nevaluate \"Project Name\" \"Description of what it does\"\n\nOptionally include a GitHub URL.", "", nil
		}
		ai := provider.New()
		if !ai.HasProviders() {
			return "", "", fmt.Errorf("no AI provider for evaluation")
		}
		result, err := analysis.EvaluateProject(ctx, ai, name, desc, "", githubURL)
		if err != nil {
			return "", "", err
		}
		// Generate PDF
		sections := []report.PDFSection{
			{Heading: "Project Description", Body: desc},
			{Heading: "AI Evaluation", Body: result.Evaluation},
		}
		pdfReport := &report.PDFReport{
			Title:    fmt.Sprintf("Project Evaluation: %s", name),
			Subtitle: "AI-Powered Qualitative Assessment (via Chat)",
			Model:    result.Model,
			Provider: result.Provider,
			Metadata: map[string]string{"Project": name},
			Sections: sections,
		}
		reportPath := ""
		if p, err := report.GeneratePDF(pdfReport); err == nil {
			reportPath = p
		}
		summary := fmt.Sprintf("Evaluation of **%s** completed.\n\n%s", name, result.Evaluation)
		return summary, reportPath, nil
	case "analyze-project":
		if addr == "" {
			return "Please provide an Octant project address (0x...) to analyze.", "", nil
		}
		// Run the 9-step pipeline data collection (without full SSE, synchronous)
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("Full Intelligence Report for %s\n\n", addr))

		// Step 1: Funding history
		history, _ := octant.GetProjectHistory(ctx, addr, 1, 10)
		if len(history) > 0 {
			sb.WriteString("**Funding History:**\n")
			for _, h := range history {
				sb.WriteString(fmt.Sprintf("E%d: %.4f alloc, %.4f matched, %d donors\n", h.Epoch, h.Allocated, h.Matched, h.Donors))
			}
			sb.WriteString("\n")
		}

		// Step 2-3: Quantitative + Trust (for latest epoch)
		latestEpoch := epoch
		if len(history) > 0 {
			latestEpoch = history[len(history)-1].Epoch
		}
		allocs, allocErr := octant.GetAllocations(ctx, latestEpoch)
		if allocErr == nil && len(allocs) > 0 {
			projects := make([]string, len(allocs))
			aDonors := make([]string, len(allocs))
			aAmounts := make([]float64, len(allocs))
			for i, a := range allocs {
				projects[i] = a.Project
				aDonors[i] = a.Donor
				aAmounts[i] = weiToEth(a.Amount)
			}
			profiles := analysis.BuildTrustProfiles(projects, aAmounts, aDonors, nil)
			for _, p := range profiles {
				if strings.EqualFold(p.Address, addr) {
					sb.WriteString(fmt.Sprintf("**Trust Profile:**\nDonors: %d | Diversity: %.3f | Whale Dep: %.3f | Coord Risk: %.3f\nFlags: %v\n\n",
						p.UniqueDonors, p.DonorDiversity, p.WhaleDepRatio, p.CoordinationRisk, p.Flags))
					break
				}
			}
		}

		// Step 7: Blockchain scan
		bc := data.NewBlockchainClient()
		signals := bc.ScanAddress(ctx, addr)
		if signals.TotalChainsActive > 0 {
			sb.WriteString(fmt.Sprintf("**Blockchain Scan:**\nActive chains: %d | Balance: %.6f | Txs: %d | Multichain: %v\n\n",
				signals.TotalChainsActive, signals.TotalBalance, signals.TotalTxCount, signals.IsMultichain))
		}

		// Step 9: AI evaluation
		ai := provider.New()
		if ai.HasProviders() {
			evalResult, evalErr := ai.CompleteChat(ctx, fmt.Sprintf("Analyze this Octant project at address %s based on the following data and provide a brief assessment:\n\n%s", addr, sb.String()), chatSystemPrompt)
			if evalErr == nil {
				sb.WriteString(fmt.Sprintf("**AI Assessment:**\n%s\n", evalResult.Text))
			}
		}

		// Generate PDF
		pdfReport := &report.PDFReport{
			Title:    fmt.Sprintf("Intelligence Report: %s", addr[:10]+"..."),
			Subtitle: "Full Analysis (via Chat)",
			Metadata: map[string]string{"Address": addr},
			Sections: []report.PDFSection{
				{Heading: "Analysis Summary", Body: sb.String()},
			},
		}
		reportPath := ""
		if p, err := report.GeneratePDF(pdfReport); err == nil {
			reportPath = p
		}

		return sb.String(), reportPath, nil
	}
	return "", "", nil
}

func handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "POST required", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Message string `json:"message"`
		Format  string `json:"format,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Message == "" {
		jsonError(w, "message required", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()

	cmd, epoch, addr := chatDetectIntent(body.Message)
	var dataContext string
	var reportPath string
	if cmd != "" {
		fetched, rp, err := chatFetchData(ctx, cmd, epoch, addr, body.Message)
		if err != nil {
			dataContext = fmt.Sprintf("Error: %s", err.Error())
		} else {
			dataContext = fetched
			reportPath = rp
		}
	}

	// If we already have a full evaluation/analysis with AI narrative, return directly
	if (cmd == "evaluate" || cmd == "analyze-project") && dataContext != "" {
		result := map[string]any{"reply": dataContext, "model": "embedded", "provider": "tessera", "command": cmd}
		if reportPath != "" {
			result["reportPath"] = reportPath
		}
		jsonOK(w, result)
		return
	}

	ai := provider.New()
	if !ai.HasProviders() {
		if dataContext != "" {
			result := map[string]any{"reply": dataContext, "model": "none", "provider": "direct-data"}
			if reportPath != "" {
				result["reportPath"] = reportPath
			}
			jsonOK(w, result)
			return
		}
		jsonError(w, "no AI provider configured", http.StatusServiceUnavailable)
		return
	}

	prompt := body.Message
	if dataContext != "" {
		prompt = fmt.Sprintf("User: %s\n\nReal data from Tessera:\n%s\n\nAnswer based on this data. Be specific with numbers.", body.Message, dataContext)
	}
	if body.Format == "json" {
		prompt += "\n\nRespond in JSON."
	}

	resp, err := ai.CompleteChat(ctx, prompt, chatSystemPrompt)
	if err != nil {
		if dataContext != "" {
			jsonOK(w, map[string]any{"reply": dataContext, "model": "none", "provider": "direct-data"})
			return
		}
		jsonError(w, "AI error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	result := map[string]any{"reply": resp.Text, "model": resp.Model, "provider": resp.Provider}
	if cmd != "" {
		result["command"] = cmd
	}
	if reportPath != "" {
		result["reportPath"] = reportPath
	}
	jsonOK(w, result)
}

func handleChatStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "POST required", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Message == "" {
		jsonError(w, "message required", http.StatusBadRequest)
		return
	}
	sse := newSSEWriter(w)
	if sse == nil {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()

	cmd, epoch, addr := chatDetectIntent(body.Message)
	var dataContext string
	if cmd != "" {
		sse.sendStep(1, 3, fmt.Sprintf("Running %s...", cmd), map[string]any{"command": cmd, "epoch": epoch})
		fetched, _, err := chatFetchData(ctx, cmd, epoch, addr, body.Message)
		if err != nil {
			dataContext = "Error: " + err.Error()
		} else {
			dataContext = fetched
		}
		sse.sendStep(2, 3, "Generating response...", nil)
	} else {
		sse.sendStep(1, 2, "Thinking...", nil)
	}

	ai := provider.New()
	if !ai.HasProviders() {
		if dataContext != "" {
			sse.sendDone(map[string]any{"reply": dataContext, "model": "none", "provider": "direct-data"})
		} else {
			sse.sendError("no AI provider configured")
		}
		return
	}

	prompt := body.Message
	if dataContext != "" {
		prompt = fmt.Sprintf("User: %s\n\nReal data:\n%s\n\nAnswer based on data.", body.Message, dataContext)
	}

	resp, err := ai.CompleteChat(ctx, prompt, chatSystemPrompt)
	if err != nil {
		if dataContext != "" {
			sse.sendDone(map[string]any{"reply": dataContext, "model": "none", "provider": "direct-data"})
		} else {
			sse.sendError("AI error: " + err.Error())
		}
		return
	}
	sse.sendDone(map[string]any{"reply": resp.Text, "model": resp.Model, "provider": resp.Provider, "command": cmd})
}


// loadRoutes registers all API routes and the static file server.
func loadRoutes() {
	// API endpoints
	handle("/api/status", handleStatus)
	handle("/api/providers", handleProviders)
	handle("/api/providers/select", handleSelectProvider)
	handle("/api/epochs/current", handleCurrentEpoch)
	handle("/api/projects", handleProjects)
	handle("/api/analyze-epoch", handleAnalyzeEpoch)
	handle("/api/detect-anomalies", handleDetectAnomalies)
	handle("/api/trust-graph", handleTrustGraph)
	handle("/api/simulate", handleSimulate)
	handle("/api/evaluate", handleEvaluate)
	handle("/api/track-project", handleTrackProject)
	handle("/api/scan-chain", handleScanChain)
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

	// Chat agent
	handle("/api/chat", handleChat)
	handle("/api/chat/stream", handleChatStream)

	// SSE streaming endpoints (long-running operations)
	handle("/api/analyze-project/stream", handleAnalyzeProjectStream)
	handle("/api/trust-graph/stream", handleTrustGraphStream)
	handle("/api/simulate/stream", handleSimulateStream)
	handle("/api/evaluate/stream", handleEvaluateStream)
	handle("/api/report-epoch/stream", handleReportEpochStream)

	// Serve static frontend files from ./frontend/dist
	// Custom handler to support Next.js static export routing
	distDir := "./frontend/dist"
	fs := http.FileServer(http.Dir(distDir))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Skip API routes
		if strings.HasPrefix(path, "/api/") {
			http.NotFound(w, r)
			return
		}

		// Try exact file first
		fullPath := filepath.Join(distDir, path)
		if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}

		// Try path.html (Next.js static export: /dashboard -> dashboard.html)
		cleanPath := strings.TrimSuffix(strings.TrimPrefix(path, "/"), "/")
		if cleanPath != "" {
			htmlPath := filepath.Join(distDir, cleanPath+".html")
			if _, err := os.Stat(htmlPath); err == nil {
				http.ServeFile(w, r, htmlPath)
				return
			}
		}

		// Try path/index.html
		indexPath := filepath.Join(distDir, path, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			http.ServeFile(w, r, indexPath)
			return
		}

		// Fallback to file server (handles _next/ static assets)
		fs.ServeHTTP(w, r)
	})
}

// Start initializes routes and starts the HTTP server.
func Start() {
	loadRoutes()
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	fmt.Printf("Tessera API server running on http://localhost:%s\n", port)
	fmt.Printf("  API:      http://localhost:%s/api/status\n", port)
	fmt.Printf("  Frontend: http://localhost:%s/\n", port)
	fmt.Printf("  SSE:      /api/analyze-project/stream, /api/trust-graph/stream, /api/simulate/stream, /api/report-epoch/stream\n")
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
