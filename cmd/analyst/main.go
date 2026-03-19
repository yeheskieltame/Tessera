package main

import (
	"context"
	"fmt"
	"math/big"
	"os"
	"sort"
	"strings"
	"text/tabwriter"

	"time"

	"github.com/yeheskieltame/tessera/internal/analysis"
	"github.com/yeheskieltame/tessera/internal/data"
	"github.com/yeheskieltame/tessera/internal/provider"
	"github.com/yeheskieltame/tessera/internal/report"
	"github.com/yeheskieltame/tessera/internal/server"
	"github.com/yeheskieltame/tessera/internal/social"
)

func main() {
	loadEnv()

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(0)
	}

	ctx := context.Background()
	cmd := os.Args[1]

	switch cmd {
	case "status":
		cmdStatus(ctx)
	case "providers":
		cmdProviders()
	case "list-projects":
		cmdListProjects(ctx)
	case "analyze-epoch":
		cmdAnalyzeEpoch(ctx)
	case "evaluate":
		cmdEvaluate(ctx)
	case "detect-anomalies":
		cmdDetectAnomalies(ctx)
	case "gitcoin-rounds":
		cmdGitcoinRounds(ctx)
	case "extract-metrics":
		cmdExtractMetrics(ctx)
	case "trust-graph":
		cmdTrustGraph(ctx)
	case "deep-eval":
		cmdDeepEval(ctx)
	case "simulate":
		cmdSimulate(ctx)
	case "scan-proposal":
		cmdScanProposal(ctx)
	case "report-epoch":
		cmdReportEpoch(ctx)
	case "analyze-project":
		cmdAnalyzeProject(ctx)
	case "collect-signals":
		cmdCollectSignals(ctx)
	case "track-project":
		cmdTrackProject(ctx)
	case "moltbook":
		cmdMoltbook(ctx)
	case "heartbeat":
		cmdHeartbeat(ctx)
	case "serve":
		cmdServe()
	case "help", "--help", "-h":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", cmd)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`Tessera — AI-powered public goods project evaluation for Octant & Gitcoin

USAGE:
  tessera <command> [flags]

COMMANDS:
  status              Check connectivity to all data sources
  providers           Show configured AI providers and fallback chain
  list-projects       List Octant projects for a given epoch
    -e <epoch>          Epoch number (default: current)
  analyze-epoch       Run quantitative analysis on all projects in an epoch
    -e <epoch>          Epoch number (required)
  evaluate            Evaluate a project using AI qualitative analysis
    <name>              Project name (required)
    -d <description>    Project description (required)
    -c <context>        Additional context (optional)
  detect-anomalies    Detect funding anomalies in donation patterns
    -e <epoch>          Epoch number (required)
  gitcoin-rounds      Analyze a Gitcoin Grants round
    -r <round-id>       Round ID (required)
    --chain <id>        Chain ID (default: 1)
  extract-metrics     Extract impact metrics from text using AI
    <text>              Text to analyze (required)
  trust-graph         Analyze donor trust graph for an epoch
    -e <epoch>          Epoch number (required)
  deep-eval           Deep multi-epoch evaluation of a project
    <address>           Project address (required)
  simulate            Simulate alternative funding mechanisms
    -e <epoch>          Epoch number (required)
  scan-proposal       Scan and verify a project proposal
    <name>              Project name (required)
    -d <description>    Proposal text (required)
  report-epoch        Generate full epoch intelligence report
    -e <epoch>          Epoch number (required)
  analyze-project     Full intelligence report for a single project (one command, all data)
    <address>           Octant project address (required)
    -e <epoch>          Epoch to analyze (default: latest with data)
    -n <oso-name>       OSO project name for cross-referencing (optional)
  track-project       Track project performance across epochs with temporal anomaly detection
    <address>           Octant project address (required)
  collect-signals     Collect OSO signals for a project (code, on-chain, funding)
    <project-name>      OSO project name (required)
  moltbook            Interact with Moltbook (social network for AI agents)
    post <title>        Create a post (-d <content> required)
    reply <post-id>     Reply to a post (-d <content> required)
    status              Show agent status and notifications
    follow <username>   Follow another agent
  heartbeat           Run Moltbook heartbeat (check notifications, auto-reply)
    --loop              Keep running every 10 minutes
  serve               Start HTTP API server (PORT env or default 8080)`)
}

// --- serve ---

func cmdServe() {
	server.Start()
}

// --- status ---

func cmdStatus(ctx context.Context) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "\n  SERVICE\tSTATUS")
	fmt.Fprintln(w, "  -------\t------")

	// Octant
	octant := data.NewOctantClient()
	if ep, err := octant.GetCurrentEpoch(ctx); err != nil {
		fmt.Fprintf(w, "  Octant API\t✗ %v\n", err)
	} else {
		fmt.Fprintf(w, "  Octant API\t✓ epoch %d\n", ep.CurrentEpoch)
	}

	// Gitcoin
	gitcoin := data.NewGitcoinClient()
	if rounds, err := gitcoin.GetRounds(ctx, 1, 1); err != nil {
		fmt.Fprintf(w, "  Gitcoin GraphQL\t✗ %v\n", err)
	} else {
		fmt.Fprintf(w, "  Gitcoin GraphQL\t✓ %d rounds\n", len(rounds))
	}

	// OSO
	oso := data.NewOSOClient()
	if _, err := oso.GetProjects(ctx, 1); err != nil {
		fmt.Fprintf(w, "  OSO API\t✗ %v\n", err)
	} else {
		fmt.Fprintf(w, "  OSO API\t✓ connected\n")
	}

	// AI
	ai := provider.New()
	fmt.Fprintf(w, "  AI Providers\t%d configured\n", len(ai.Providers()))

	w.Flush()
	fmt.Println()
}

// --- providers ---

func cmdProviders() {
	ai := provider.New()
	providers := ai.Providers()
	if len(providers) == 0 {
		fmt.Println("No providers configured. Options:")
		fmt.Println("  1. Install Claude Code (claude CLI) — works with Max plan, no API key needed")
		fmt.Println("  2. Set API keys in .env: ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY")
		return
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "\n  #\tPROVIDER\tMODEL")
	fmt.Fprintln(w, "  -\t--------\t-----")
	for i, p := range providers {
		fmt.Fprintf(w, "  %d\t%s\t%s\n", i+1, p.Name, p.Model)
	}
	w.Flush()
	fmt.Println()
}

// --- list-projects ---

func cmdListProjects(ctx context.Context) {
	epoch := flagInt("-e", 0)
	octant := data.NewOctantClient()

	if epoch == 0 {
		ep, err := octant.GetCurrentEpoch(ctx)
		exitOnErr(err)
		epoch = ep.CurrentEpoch
	}

	projects, err := octant.GetProjects(ctx, epoch)
	exitOnErr(err)

	fmt.Printf("\nOctant Epoch %d — %d projects\n\n", epoch, len(projects))

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "  #\tADDRESS")
	fmt.Fprintln(w, "  -\t-------")
	for i, addr := range projects {
		display := addr
		if len(addr) > 16 {
			display = addr[:8] + "..." + addr[len(addr)-6:]
		}
		fmt.Fprintf(w, "  %d\t%s\n", i+1, display)
	}
	w.Flush()
	fmt.Println()
}

// --- analyze-epoch ---

func cmdAnalyzeEpoch(ctx context.Context) {
	epoch := flagInt("-e", 0)
	if epoch == 0 {
		fmt.Fprintln(os.Stderr, "Error: -e <epoch> is required")
		os.Exit(1)
	}

	octant := data.NewOctantClient()
	rewards, err := octant.GetProjectRewards(ctx, epoch)
	exitOnErr(err)

	if len(rewards) == 0 {
		fmt.Println("No reward data found for this epoch.")
		return
	}

	// Build metrics
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

	// Score
	metrics = analysis.ComputeCompositeScores(metrics)

	// Cluster
	k := 4
	if len(metrics) < 4 {
		k = len(metrics)
	}
	metrics = analysis.SimpleKMeans(metrics, k)

	// Sort by score
	sort.Slice(metrics, func(i, j int) bool { return metrics[i].CompositeScore > metrics[j].CompositeScore })

	fmt.Printf("\nEpoch %d Analysis — %d projects\n\n", epoch, len(metrics))

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "  RANK\tADDRESS\tALLOCATED (ETH)\tMATCHED (ETH)\tSCORE\tCLUSTER")
	fmt.Fprintln(w, "  ----\t-------\t---------------\t-------------\t-----\t-------")
	for i, m := range metrics {
		addr := m.Address
		if len(addr) > 14 {
			addr = addr[:8] + "..." + addr[len(addr)-4:]
		}
		fmt.Fprintf(w, "  %d\t%s\t%.4f\t%.4f\t%.1f\t%d\n",
			i+1, addr, m.Allocated, m.Matched, m.CompositeScore, m.Cluster)
	}
	w.Flush()
	fmt.Println()
}

// --- evaluate ---

func cmdEvaluate(ctx context.Context) {
	name := flagString("", 0) // positional after "evaluate"
	desc := flagString("-d", 0)
	extra := flagString("-c", 0)

	if name == "" || desc == "" {
		fmt.Fprintln(os.Stderr, "Usage: analyst evaluate <name> -d <description> [-c <context>]")
		os.Exit(1)
	}

	ai := provider.New()
	if !ai.HasProviders() {
		fmt.Fprintln(os.Stderr, "No AI providers configured. Set an API key in .env")
		os.Exit(1)
	}

	fmt.Printf("Evaluating %s...\n", name)
	result, err := analysis.EvaluateProject(ctx, ai, name, desc, extra)
	exitOnErr(err)

	fmt.Printf("\n══════ Evaluation: %s ══════\n\n", result.Project)
	fmt.Println(result.Evaluation)
	fmt.Printf("\n[via %s/%s]\n", result.Provider, result.Model)

	// Save report
	report.Generate(name, nil, map[string]string{
		"evaluation": result.Evaluation,
		"model":      result.Model,
		"provider":   result.Provider,
	}, nil)
	fmt.Println("\nReport saved to reports/")
}

// --- detect-anomalies ---

func cmdDetectAnomalies(ctx context.Context) {
	epoch := flagInt("-e", 0)
	if epoch == 0 {
		fmt.Fprintln(os.Stderr, "Error: -e <epoch> is required")
		os.Exit(1)
	}

	octant := data.NewOctantClient()
	allocations, err := octant.GetAllocations(ctx, epoch)
	exitOnErr(err)

	if len(allocations) == 0 {
		fmt.Println("No allocation data found.")
		return
	}

	donors := make([]string, len(allocations))
	amounts := make([]float64, len(allocations))
	for i, a := range allocations {
		donors[i] = a.Donor
		n := new(big.Int)
		n.SetString(a.Amount, 10)
		f := new(big.Float).SetInt(n)
		eth, _ := new(big.Float).Quo(f, big.NewFloat(1e18)).Float64()
		amounts[i] = eth
	}

	r := analysis.DetectAnomalies(donors, amounts)

	fmt.Printf("\nFunding Anomaly Report — Epoch %d\n\n", epoch)

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "  Total Donations\t%d\n", r.TotalDonations)
	fmt.Fprintf(w, "  Unique Donors\t%d\n", r.UniqueDonors)
	fmt.Fprintf(w, "  Total Amount\t%.4f ETH\n", r.TotalAmount)
	fmt.Fprintf(w, "  Mean Donation\t%.6f ETH\n", r.MeanDonation)
	fmt.Fprintf(w, "  Median Donation\t%.6f ETH\n", r.MedianDonation)
	fmt.Fprintf(w, "  Max Donation\t%.6f ETH\n", r.MaxDonation)
	fmt.Fprintf(w, "  Whale Concentration\t%.1f%%\n", r.WhaleConcentration*100)
	w.Flush()

	if len(r.Flags) > 0 {
		fmt.Println("\n  ⚠ Flags:")
		for _, f := range r.Flags {
			fmt.Printf("    - %s\n", f)
		}
	} else {
		fmt.Println("\n  ✓ No suspicious patterns detected.")
	}
	fmt.Println()
}

// --- gitcoin-rounds ---

func cmdGitcoinRounds(ctx context.Context) {
	roundID := flagString("-r", 0)
	chainID := flagInt("--chain", 1)

	if roundID == "" {
		fmt.Fprintln(os.Stderr, "Usage: analyst gitcoin-rounds -r <round-id> [--chain <id>]")
		os.Exit(1)
	}

	gitcoin := data.NewGitcoinClient()
	projects, err := gitcoin.GetRoundProjects(ctx, roundID, chainID)
	exitOnErr(err)

	sort.Slice(projects, func(i, j int) bool {
		return projects[i].TotalAmountDonatedInUsd > projects[j].TotalAmountDonatedInUsd
	})

	fmt.Printf("\nGitcoin Round — %d approved projects\n\n", len(projects))

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "  #\tPROJECT ID\tDONORS\tDONATED (USD)")
	fmt.Fprintln(w, "  -\t----------\t------\t-------------")
	limit := 20
	if len(projects) < limit {
		limit = len(projects)
	}
	for i := 0; i < limit; i++ {
		p := projects[i]
		pid := p.ProjectID
		if len(pid) > 20 {
			pid = pid[:20] + "..."
		}
		fmt.Fprintf(w, "  %d\t%s\t%d\t$%.2f\n", i+1, pid, p.UniqueDonorsCount, p.TotalAmountDonatedInUsd)
	}
	w.Flush()
	fmt.Println()
}

// --- extract-metrics ---

func cmdExtractMetrics(ctx context.Context) {
	text := flagString("", 0)
	if text == "" {
		fmt.Fprintln(os.Stderr, "Usage: analyst extract-metrics <text>")
		os.Exit(1)
	}

	ai := provider.New()
	if !ai.HasProviders() {
		fmt.Fprintln(os.Stderr, "No AI providers configured.")
		os.Exit(1)
	}

	fmt.Println("Extracting metrics...")
	result, err := analysis.ExtractImpactMetrics(ctx, ai, text)
	exitOnErr(err)

	fmt.Println("\n══════ Extracted Impact Metrics ══════")
	fmt.Println(result.Evaluation)
	fmt.Printf("\n[via %s/%s]\n", result.Provider, result.Model)
}

// --- helpers ---

func loadEnv() {
	data, err := os.ReadFile(".env")
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if k, v, ok := strings.Cut(line, "="); ok {
			k = strings.TrimSpace(k)
			v = strings.TrimSpace(v)
			if os.Getenv(k) == "" { // don't override existing env
				os.Setenv(k, v)
			}
		}
	}
}

func flagString(name string, defaultVal int) string {
	args := os.Args[2:]
	if name == "" {
		// positional: first arg that doesn't start with -
		for _, a := range args {
			if !strings.HasPrefix(a, "-") {
				return a
			}
		}
		return ""
	}
	for i, a := range args {
		if a == name && i+1 < len(args) {
			return args[i+1]
		}
	}
	return ""
}

func flagInt(name string, defaultVal int) int {
	s := flagString(name, 0)
	if s == "" {
		return defaultVal
	}
	var n int
	fmt.Sscanf(s, "%d", &n)
	if n == 0 {
		return defaultVal
	}
	return n
}

func exitOnErr(err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

// --- trust-graph ---

func cmdTrustGraph(ctx context.Context) {
	epoch := flagInt("-e", 0)
	if epoch == 0 {
		fmt.Fprintln(os.Stderr, "Error: -e <epoch> is required")
		os.Exit(1)
	}

	octant := data.NewOctantClient()
	allocations, err := octant.GetAllocations(ctx, epoch)
	exitOnErr(err)

	if len(allocations) == 0 {
		fmt.Println("No allocation data found.")
		return
	}

	// Extract parallel slices for BuildTrustProfiles
	projects := make([]string, len(allocations))
	donors := make([]string, len(allocations))
	amounts := make([]float64, len(allocations))
	for i, a := range allocations {
		projects[i] = a.Project
		donors[i] = a.Donor
		n := new(big.Int)
		n.SetString(a.Amount, 10)
		f := new(big.Float).SetInt(n)
		eth, _ := new(big.Float).Quo(f, big.NewFloat(1e18)).Float64()
		amounts[i] = eth
	}

	// Get previous epoch donors for repeat detection
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

	fmt.Printf("Building trust graph for Epoch %d...\n", epoch)
	profiles := analysis.BuildTrustProfiles(projects, amounts, donors, prevDonors)

	// Print summary table
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "\nTrust Graph — Epoch %d (%d projects)\n\n", epoch, len(profiles))
	fmt.Fprintln(w, "  ADDRESS\tDONORS\tDIVERSITY\tWHALE DEP\tCOORD RISK\tFLAGS")
	fmt.Fprintln(w, "  -------\t------\t---------\t---------\t----------\t-----")
	for _, p := range profiles {
		addr := p.Address
		if len(addr) > 14 {
			addr = addr[:8] + "..." + addr[len(addr)-4:]
		}
		flagCount := len(p.Flags)
		fmt.Fprintf(w, "  %s\t%d\t%.3f\t%.1f%%\t%.3f\t%d\n",
			addr, p.UniqueDonors, p.DonorDiversity, p.WhaleDepRatio*100, p.CoordinationRisk, flagCount)
	}
	w.Flush()

	// Detect donor clusters
	donorProjects := map[string][]string{}
	for i, d := range donors {
		donorProjects[d] = append(donorProjects[d], projects[i])
	}
	clusters := analysis.DetectDonorClusters(donorProjects)
	if len(clusters) > 0 {
		fmt.Printf("\n  Donor clusters detected: %d (groups with >70%% project overlap)\n", len(clusters))
		for i, c := range clusters {
			if i >= 5 {
				break
			}
			fmt.Printf("    Cluster %d: %d donors\n", i+1, len(c))
		}
	}

	// AI narrative
	ai := provider.New()
	if ai.HasProviders() {
		fmt.Println("\nGenerating trust narrative...")
		result, err := analysis.NarrateTrustProfile(ctx, ai, profiles, epoch)
		if err != nil {
			fmt.Fprintf(os.Stderr, "AI analysis failed: %v\n", err)
			return
		}
		fmt.Printf("\n%s\n\n[via %s/%s]\n", result.Evaluation, result.Provider, result.Model)
	}
	fmt.Println()
}

// --- deep-eval ---

func cmdDeepEval(ctx context.Context) {
	address := flagString("", 0)
	if address == "" {
		fmt.Fprintln(os.Stderr, "Usage: tessera deep-eval <project-address>")
		os.Exit(1)
	}

	ai := provider.New()
	if !ai.HasProviders() {
		fmt.Fprintln(os.Stderr, "No AI providers configured.")
		os.Exit(1)
	}

	octant := data.NewOctantClient()
	ep, err := octant.GetCurrentEpoch(ctx)
	exitOnErr(err)

	fmt.Printf("Fetching history for %s across epochs 1-%d...\n", address, ep.CurrentEpoch)
	history, err := octant.GetProjectHistory(ctx, address, 1, ep.CurrentEpoch)
	exitOnErr(err)

	if len(history) == 0 {
		fmt.Println("No data found for this address in any epoch.")
		return
	}

	// Optionally collect OSO signals
	osoMetrics := ""
	osoName := flagString("-n", 0)
	if osoName != "" {
		oso := data.NewOSOClient()
		signals := oso.CollectProjectSignals(ctx, osoName)
		osoMetrics = signals.FormatSignals()
		if osoMetrics != "" && osoMetrics != "No OSO data available for this project." {
			fmt.Printf("OSO signals collected for %s\n", osoName)
		}
	}

	fmt.Printf("Found data in %d epochs. Running deep evaluation...\n", len(history))
	result, err := analysis.DeepEvaluateProject(ctx, ai, address, history, osoMetrics)
	exitOnErr(err)

	fmt.Printf("\n══════ Deep Evaluation: %s ══════\n\n", address)
	fmt.Println(result.Evaluation)
	fmt.Printf("\n[via %s/%s]\n", result.Provider, result.Model)
}

// --- simulate ---

func cmdSimulate(ctx context.Context) {
	epoch := flagInt("-e", 0)
	if epoch == 0 {
		fmt.Fprintln(os.Stderr, "Error: -e <epoch> is required")
		os.Exit(1)
	}

	octant := data.NewOctantClient()
	allocations, err := octant.GetAllocations(ctx, epoch)
	exitOnErr(err)

	if len(allocations) == 0 {
		fmt.Println("No allocation data found.")
		return
	}

	// Convert to AllocationInput
	inputs := make([]analysis.AllocationInput, len(allocations))
	for i, a := range allocations {
		n := new(big.Int)
		n.SetString(a.Amount, 10)
		f := new(big.Float).SetInt(n)
		eth, _ := new(big.Float).Quo(f, big.NewFloat(1e18)).Float64()
		inputs[i] = analysis.AllocationInput{
			Donor:   a.Donor,
			Project: a.Project,
			Amount:  eth,
		}
	}

	fmt.Printf("Simulating funding mechanisms for Epoch %d (%d allocations)...\n\n", epoch, len(inputs))

	// Build trust scores from allocation data for trust-weighted QF
	projects := make([]string, len(allocations))
	donors := make([]string, len(allocations))
	amounts := make([]float64, len(inputs))
	for i, a := range allocations {
		projects[i] = a.Project
		donors[i] = a.Donor
		amounts[i] = inputs[i].Amount
	}
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

	// Print comparison
	table := analysis.CompareDistributions(original, []analysis.MechanismResult{capped, equal, trustWeighted})
	fmt.Println(table)

	// AI analysis
	ai := provider.New()
	if ai.HasProviders() {
		fmt.Println("Generating mechanism analysis...")
		result, err := analysis.AnalyzeMechanisms(ctx, ai, original, []analysis.MechanismResult{capped, equal, trustWeighted}, epoch)
		if err != nil {
			fmt.Fprintf(os.Stderr, "AI analysis failed: %v\n", err)
			return
		}
		fmt.Printf("\n%s\n\n[via %s/%s]\n", result.Evaluation, result.Provider, result.Model)
	}
}

// --- scan-proposal ---

func cmdScanProposal(ctx context.Context) {
	name := flagString("", 0)
	desc := flagString("-d", 0)

	if name == "" || desc == "" {
		fmt.Fprintln(os.Stderr, "Usage: tessera scan-proposal <name> -d <description>")
		os.Exit(1)
	}

	ai := provider.New()
	if !ai.HasProviders() {
		fmt.Fprintln(os.Stderr, "No AI providers configured.")
		os.Exit(1)
	}

	fmt.Printf("Scanning proposal: %s...\n", name)
	result, err := analysis.ScanProposal(ctx, ai, name, desc, nil)
	exitOnErr(err)

	fmt.Printf("\n══════ Proposal Scan: %s ══════\n\n", name)
	fmt.Println(result.Evaluation)
	fmt.Printf("\n[via %s/%s]\n", result.Provider, result.Model)
}

// --- report-epoch ---

func cmdReportEpoch(ctx context.Context) {
	epoch := flagInt("-e", 0)
	if epoch == 0 {
		fmt.Fprintln(os.Stderr, "Error: -e <epoch> is required")
		os.Exit(1)
	}

	octant := data.NewOctantClient()

	// Step 1: Quantitative analysis
	fmt.Printf("=== Epoch %d Intelligence Report ===\n\n", epoch)
	fmt.Println("[1/4] Running quantitative analysis...")
	rewards, err := octant.GetProjectRewards(ctx, epoch)
	exitOnErr(err)

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

	// Step 2: Anomaly detection
	fmt.Println("[2/4] Detecting anomalies...")
	allocations, err := octant.GetAllocations(ctx, epoch)
	exitOnErr(err)

	allDonors := make([]string, len(allocations))
	allAmounts := make([]float64, len(allocations))
	allProjects := make([]string, len(allocations))
	for i, a := range allocations {
		allDonors[i] = a.Donor
		allProjects[i] = a.Project
		n := new(big.Int)
		n.SetString(a.Amount, 10)
		f := new(big.Float).SetInt(n)
		eth, _ := new(big.Float).Quo(f, big.NewFloat(1e18)).Float64()
		allAmounts[i] = eth
	}
	anomalyReport := analysis.DetectAnomalies(allDonors, allAmounts)

	// Step 3: Trust graph
	fmt.Println("[3/4] Building trust graph...")
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
	trustProfiles := analysis.BuildTrustProfiles(allProjects, allAmounts, allDonors, prevDonors)

	// Step 4: Mechanism simulation
	fmt.Println("[4/4] Simulating mechanisms...")
	inputs := make([]analysis.AllocationInput, len(allocations))
	for i, a := range allocations {
		inputs[i] = analysis.AllocationInput{Donor: a.Donor, Project: a.Project, Amount: allAmounts[i]}
	}
	originalMech := analysis.SimulateStandardQF(inputs)
	originalMech.Name = "Original (Standard QF)"
	cappedMech := analysis.SimulateCappedQF(inputs, 0.10)
	equalMech := analysis.SimulateEqualWeight(inputs)

	// Print quantitative results
	fmt.Printf("\n── Quantitative Rankings (%d projects) ──\n\n", len(metrics))
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "  RANK\tADDRESS\tSCORE\tCLUSTER\tALLOCATED\tMATCHED")
	fmt.Fprintln(w, "  ----\t-------\t-----\t-------\t---------\t-------")
	for i, m := range metrics {
		addr := m.Address
		if len(addr) > 14 {
			addr = addr[:8] + "..." + addr[len(addr)-4:]
		}
		fmt.Fprintf(w, "  %d\t%s\t%.1f\t%d\t%.4f\t%.4f\n",
			i+1, addr, m.CompositeScore, m.Cluster, m.Allocated, m.Matched)
	}
	w.Flush()

	// Print anomaly summary
	fmt.Printf("\n── Anomaly Detection ──\n\n")
	fmt.Printf("  Donations: %d | Donors: %d | Total: %.4f ETH | Whale: %.1f%%\n",
		anomalyReport.TotalDonations, anomalyReport.UniqueDonors, anomalyReport.TotalAmount, anomalyReport.WhaleConcentration*100)
	for _, f := range anomalyReport.Flags {
		fmt.Printf("  Flag: %s\n", f)
	}

	// Print trust summary
	fmt.Printf("\n── Trust Graph ──\n\n")
	flaggedCount := 0
	for _, p := range trustProfiles {
		if len(p.Flags) > 0 {
			flaggedCount++
		}
	}
	fmt.Printf("  Projects: %d | Flagged: %d\n", len(trustProfiles), flaggedCount)

	// Print mechanism comparison
	fmt.Printf("\n── Mechanism Simulation ──\n\n")
	fmt.Println(analysis.CompareDistributions(originalMech, []analysis.MechanismResult{cappedMech, equalMech}))

	// AI synthesis
	ai := provider.New()
	if ai.HasProviders() {
		fmt.Println("Generating AI intelligence synthesis...")
		// Build context for LLM
		var context strings.Builder
		context.WriteString(fmt.Sprintf("Epoch %d has %d projects, %d donations from %d unique donors, totaling %.4f ETH.\n",
			epoch, len(metrics), anomalyReport.TotalDonations, anomalyReport.UniqueDonors, anomalyReport.TotalAmount))
		context.WriteString(fmt.Sprintf("Whale concentration: %.1f%%\n", anomalyReport.WhaleConcentration*100))
		context.WriteString(fmt.Sprintf("Trust-flagged projects: %d/%d\n", flaggedCount, len(trustProfiles)))
		context.WriteString(fmt.Sprintf("Mechanism Gini: Original=%.3f, Capped=%.3f, Equal=%.3f\n",
			originalMech.GiniCoeff, cappedMech.GiniCoeff, equalMech.GiniCoeff))
		context.WriteString("\nTop 5 projects by score:\n")
		for i := 0; i < 5 && i < len(metrics); i++ {
			m := metrics[i]
			context.WriteString(fmt.Sprintf("  %d. %s — Score %.1f, %.4f ETH total\n", i+1, m.Address, m.CompositeScore, m.TotalFunding))
		}

		prompt := fmt.Sprintf(`Generate an executive intelligence summary for Octant Epoch %d based on this data:

%s

Provide:
1. **Executive Summary** (2-3 sentences)
2. **Key Findings** (top 3-5 insights an evaluator must know)
3. **Risk Alerts** (funding health, sybil risk, concentration issues)
4. **Recommendations** (actionable next steps for Octant governance)

Be concise and data-driven.`, epoch, context.String())

		result, err := ai.Complete(ctx, prompt, "You are a public goods funding intelligence analyst for Octant.")
		if err == nil {
			fmt.Printf("\n── AI Intelligence Summary ──\n\n%s\n\n[via %s/%s]\n", result.Text, result.Provider, result.Model)
		}
	}

	fmt.Println()
}

// --- analyze-project (killer demo: one command, full intelligence) ---

func cmdAnalyzeProject(ctx context.Context) {
	address := flagString("", 0)
	if address == "" {
		fmt.Fprintln(os.Stderr, "Usage: tessera analyze-project <address> [-e <epoch>] [-n <oso-name>]")
		os.Exit(1)
	}

	ai := provider.New()
	if !ai.HasProviders() {
		fmt.Fprintln(os.Stderr, "No AI providers configured.")
		os.Exit(1)
	}

	octant := data.NewOctantClient()
	osoName := flagString("-n", 0)

	fmt.Printf("══════ Full Intelligence Report: %s ══════\n\n", address)

	// Step 1: Find which epochs this project appears in
	fmt.Println("[1/6] Fetching cross-epoch funding history...")
	ep, err := octant.GetCurrentEpoch(ctx)
	exitOnErr(err)

	history, err := octant.GetProjectHistory(ctx, address, 1, ep.CurrentEpoch)
	exitOnErr(err)

	if len(history) == 0 {
		fmt.Println("Project not found in any Octant epoch.")
		return
	}

	fmt.Printf("  Found in %d epochs\n", len(history))
	for _, h := range history {
		fmt.Printf("  Epoch %d: %.4f allocated + %.4f matched, %d donors\n",
			h.Epoch, h.Allocated, h.Matched, h.Donors)
	}

	// Use latest epoch with data, or user-specified
	epoch := flagInt("-e", 0)
	if epoch == 0 {
		epoch = history[len(history)-1].Epoch
	}

	// Step 2: Quantitative scoring in that epoch
	fmt.Printf("\n[2/6] Quantitative analysis (Epoch %d)...\n", epoch)
	rewards, err := octant.GetProjectRewards(ctx, epoch)
	exitOnErr(err)

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

	// Find this project's rank
	var projectMetric analysis.ProjectMetrics
	projectRank := 0
	for i, m := range metrics {
		if strings.EqualFold(m.Address, address) {
			projectMetric = m
			projectRank = i + 1
			break
		}
	}
	if projectRank > 0 {
		fmt.Printf("  Rank: %d/%d | Score: %.1f | Allocated: %.4f ETH | Matched: %.4f ETH\n",
			projectRank, len(metrics), projectMetric.CompositeScore, projectMetric.Allocated, projectMetric.Matched)
	}

	// Step 3: Trust profile
	fmt.Printf("\n[3/6] Trust graph analysis...\n")
	allocations, err := octant.GetAllocations(ctx, epoch)
	exitOnErr(err)

	allProjects := make([]string, len(allocations))
	allDonors := make([]string, len(allocations))
	allAmounts := make([]float64, len(allocations))
	for i, a := range allocations {
		allProjects[i] = a.Project
		allDonors[i] = a.Donor
		n := new(big.Int)
		n.SetString(a.Amount, 10)
		f := new(big.Float).SetInt(n)
		eth, _ := new(big.Float).Quo(f, big.NewFloat(1e18)).Float64()
		allAmounts[i] = eth
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
		if strings.EqualFold(tp.Address, address) {
			projectTrust = &trustProfiles[i]
			break
		}
	}

	if projectTrust != nil {
		fmt.Printf("  Donors: %d | Diversity: %.3f | Whale dep: %.1f%% | Coord risk: %.3f | Repeat: %d\n",
			projectTrust.UniqueDonors, projectTrust.DonorDiversity, projectTrust.WhaleDepRatio*100,
			projectTrust.CoordinationRisk, projectTrust.RepeatDonors)
		for _, f := range projectTrust.Flags {
			fmt.Printf("  Flag: %s\n", f)
		}
	}

	// Step 4: Mechanism impact
	fmt.Printf("\n[4/6] Mechanism simulation impact...\n")
	inputs := make([]analysis.AllocationInput, len(allocations))
	for i := range allocations {
		inputs[i] = analysis.AllocationInput{Donor: allDonors[i], Project: allProjects[i], Amount: allAmounts[i]}
	}
	trustScores := map[string]float64{}
	for _, tp := range trustProfiles {
		trustScores[tp.Address] = tp.DonorDiversity
	}

	original := analysis.SimulateStandardQF(inputs)
	capped := analysis.SimulateCappedQF(inputs, 0.10)
	equal := analysis.SimulateEqualWeight(inputs)
	trustWeighted := analysis.SimulateTrustWeightedQF(inputs, trustScores)

	// Find this project in each mechanism
	findProject := func(mech analysis.MechanismResult) *analysis.SimulatedProject {
		for _, p := range mech.Projects {
			if strings.EqualFold(p.Address, address) {
				return &p
			}
		}
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "  MECHANISM\tALLOCATED\tCHANGE")
	fmt.Fprintln(w, "  ---------\t---------\t------")
	for _, mech := range []analysis.MechanismResult{original, capped, equal, trustWeighted} {
		p := findProject(mech)
		if p != nil {
			fmt.Fprintf(w, "  %s\t%.4f ETH\t%+.1f%%\n", mech.Name, p.Allocated, p.Change)
		}
	}
	w.Flush()

	// Step 5: OSO signals (optional)
	osoMetrics := ""
	if osoName != "" {
		fmt.Printf("\n[5/6] Collecting OSO signals (%s)...\n", osoName)
		oso := data.NewOSOClient()
		signals := oso.CollectProjectSignals(ctx, osoName)
		osoMetrics = signals.FormatSignals()
		if osoMetrics != "No OSO data available for this project." {
			fmt.Println(osoMetrics)
		} else {
			fmt.Println("  OSO API unavailable or no data found.")
			osoMetrics = ""
		}
	} else {
		fmt.Printf("\n[5/6] OSO signals skipped (use -n <oso-name> to enable)\n")
	}

	// Step 6: AI synthesis
	fmt.Printf("\n[6/6] Generating AI deep evaluation...\n")

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
	contextData.WriteString(fmt.Sprintf("Mechanism impact: Standard QF → Capped QF %+.1f%%, Equal Weight %+.1f%%, Trust-Weighted %+.1f%%\n",
		findProject(capped).Change, findProject(equal).Change, findProject(trustWeighted).Change))

	// Combine with deep eval
	result, err := analysis.DeepEvaluateProject(ctx, ai, address, history, osoMetrics+"\n\n"+contextData.String())
	exitOnErr(err)

	fmt.Printf("\n── AI Deep Evaluation ──\n\n%s\n\n[via %s/%s]\n\n", result.Evaluation, result.Provider, result.Model)

	// Save markdown report
	report.Generate(address, map[string]string{
		"rank":            fmt.Sprintf("%d/%d", projectRank, len(metrics)),
		"composite_score": fmt.Sprintf("%.1f", projectMetric.CompositeScore),
		"allocated_eth":   fmt.Sprintf("%.4f", projectMetric.Allocated),
		"matched_eth":     fmt.Sprintf("%.4f", projectMetric.Matched),
		"donor_diversity": fmt.Sprintf("%.3f", projectTrust.DonorDiversity),
		"whale_dependency": fmt.Sprintf("%.1f%%", projectTrust.WhaleDepRatio*100),
	}, map[string]string{
		"evaluation": result.Evaluation,
		"model":      result.Model,
		"provider":   result.Provider,
	}, nil)
	fmt.Println("Markdown report saved to reports/")

	// Generate PDF report
	shortAddr := address
	if len(shortAddr) > 14 {
		shortAddr = shortAddr[:8] + "..." + shortAddr[len(shortAddr)-4:]
	}

	mechRows := [][]string{}
	for _, mech := range []analysis.MechanismResult{original, capped, equal, trustWeighted} {
		p := findProject(mech)
		if p != nil {
			mechRows = append(mechRows, []string{mech.Name, fmt.Sprintf("%.4f ETH", p.Allocated), fmt.Sprintf("%+.1f%%", p.Change)})
		}
	}

	histRows := [][]string{}
	for _, h := range history {
		histRows = append(histRows, []string{
			fmt.Sprintf("%d", h.Epoch),
			fmt.Sprintf("%.4f", h.Allocated),
			fmt.Sprintf("%.4f", h.Matched),
			fmt.Sprintf("%d", h.Donors),
		})
	}

	pdfReport := &report.PDFReport{
		Title:    fmt.Sprintf("Intelligence Report: %s", shortAddr),
		Subtitle: fmt.Sprintf("Octant Public Goods Evaluation | Epoch %d", epoch),
		Model:    result.Model,
		Provider: result.Provider,
		Metadata: map[string]string{
			"Address":          address,
			"Rank":             fmt.Sprintf("%d / %d projects", projectRank, len(metrics)),
			"Composite Score":  fmt.Sprintf("%.1f / 100", projectMetric.CompositeScore),
			"Donor Diversity":  fmt.Sprintf("%.3f (Shannon entropy)", projectTrust.DonorDiversity),
			"Whale Dependency": fmt.Sprintf("%.1f%%", projectTrust.WhaleDepRatio*100),
			"AI Model":         result.Model,
		},
		Sections: []report.PDFSection{
			{
				Heading: "Funding History",
				Table: &report.PDFTable{
					Headers: []string{"Epoch", "Allocated (ETH)", "Matched (ETH)", "Donors"},
					Rows:    histRows,
					ColW:    []float64{25, 45, 45, 30},
				},
			},
			{
				Heading: "Trust Profile",
				Body: fmt.Sprintf("Unique Donors: %d\nDonor Diversity (Shannon): %.3f\nWhale Dependency: %.1f%%\nCoordination Risk (Jaccard): %.3f\nRepeat Donors: %d",
					projectTrust.UniqueDonors, projectTrust.DonorDiversity, projectTrust.WhaleDepRatio*100, projectTrust.CoordinationRisk, projectTrust.RepeatDonors),
			},
			{
				Heading: "Mechanism Simulation Impact",
				Table: &report.PDFTable{
					Headers: []string{"Mechanism", "Allocated", "Change"},
					Rows:    mechRows,
					ColW:    []float64{70, 50, 40},
				},
			},
			{
				Heading: "AI Deep Evaluation",
				Body:    result.Evaluation,
			},
		},
	}

	pdfPath, err := report.GeneratePDF(pdfReport)
	if err != nil {
		fmt.Fprintf(os.Stderr, "PDF generation failed: %v\n", err)
	} else {
		fmt.Printf("PDF report saved to %s\n", pdfPath)
	}
}

// --- collect-signals ---

func cmdCollectSignals(ctx context.Context) {
	projectName := flagString("", 0)
	if projectName == "" {
		fmt.Fprintln(os.Stderr, "Usage: tessera collect-signals <project-name>")
		os.Exit(1)
	}

	oso := data.NewOSOClient()
	fmt.Printf("Collecting OSO signals for: %s\n\n", projectName)

	signals := oso.CollectProjectSignals(ctx, projectName)
	formatted := signals.FormatSignals()
	fmt.Println(formatted)

	// AI analysis if available
	ai := provider.New()
	if ai.HasProviders() && (signals.Code != nil || signals.Onchain != nil || signals.Funding != nil) {
		fmt.Println("Generating signal analysis...")
		prompt := fmt.Sprintf(`Analyze these Open Source Observer (OSO) signals for the project "%s":

%s

Provide:
1. **Development Health**: Is the project actively maintained? How does contributor activity compare to similar projects?
2. **On-Chain Traction**: Is there real usage? Are users returning or one-time?
3. **Funding Efficiency**: How does funding received compare to development output?
4. **Legitimacy Signals**: What signals suggest this is a legitimate public good vs. potential gaming?
5. **Red Flags**: Any concerning patterns in the data?

Be specific and reference the numbers.`, projectName, formatted)

		result, err := ai.Complete(ctx, prompt, "You are a public goods data analyst specializing in cross-referencing GitHub activity, on-chain metrics, and funding data to assess project legitimacy.")
		if err == nil {
			fmt.Printf("\n%s\n\n[via %s/%s]\n", result.Text, result.Provider, result.Model)
		}
	}
}

// --- track-project ---

func cmdTrackProject(ctx context.Context) {
	address := flagString("", 0)
	if address == "" {
		fmt.Fprintln(os.Stderr, "Usage: tessera track-project <project-address>")
		os.Exit(1)
	}

	octant := data.NewOctantClient()
	ep, err := octant.GetCurrentEpoch(ctx)
	exitOnErr(err)

	fmt.Printf("Tracking project %s across epochs 1-%d...\n\n", address, ep.CurrentEpoch)

	// Fetch project history
	history, err := octant.GetProjectHistory(ctx, address, 1, ep.CurrentEpoch)
	exitOnErr(err)

	if len(history) == 0 {
		fmt.Println("No data found for this address in any epoch.")
		return
	}

	// Print timeline table
	fmt.Println("═══ Project Timeline ═══")
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "  Epoch\tAllocated (ETH)\tMatched (ETH)\tTotal (ETH)\tDonors\n")
	fmt.Fprintf(w, "  ─────\t───────────────\t─────────────\t───────────\t──────\n")
	for _, h := range history {
		fmt.Fprintf(w, "  %d\t%.4f\t%.4f\t%.4f\t%d\n", h.Epoch, h.Allocated, h.Matched, h.Allocated+h.Matched, h.Donors)
	}
	w.Flush()
	fmt.Println()

	// Temporal anomaly detection: compare latest 2 epochs with data
	if len(history) >= 2 {
		prevEpoch := history[len(history)-2].Epoch
		currEpoch := history[len(history)-1].Epoch

		fmt.Printf("═══ Temporal Anomaly Detection (Epoch %d → %d) ═══\n", prevEpoch, currEpoch)

		// Fetch allocations for both epochs
		prevAllocs, err := octant.GetAllocations(ctx, prevEpoch)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  Warning: could not fetch epoch %d allocations: %v\n", prevEpoch, err)
		}
		currAllocs, err := octant.GetAllocations(ctx, currEpoch)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  Warning: could not fetch epoch %d allocations: %v\n", currEpoch, err)
		}

		if prevAllocs != nil && currAllocs != nil {
			// Convert allocations to parallel slices
			convertAllocs := func(allocs []data.Allocation) ([]string, []float64, []string) {
				donors := make([]string, len(allocs))
				amounts := make([]float64, len(allocs))
				projects := make([]string, len(allocs))
				for i, a := range allocs {
					donors[i] = a.Donor
					amounts[i] = analysis.WeiToEth(a.Amount)
					projects[i] = a.Project
				}
				return donors, amounts, projects
			}

			prevD, prevA, prevP := convertAllocs(prevAllocs)
			currD, currA, currP := convertAllocs(currAllocs)

			anomalies := analysis.DetectTemporalAnomalies(currD, currA, currP, prevD, prevA, prevP, prevEpoch, currEpoch)

			if len(anomalies) > 0 {
				for _, a := range anomalies {
					sev := "  "
					switch a.Severity {
					case "high":
						sev = "!!"
					case "medium":
						sev = "! "
					}
					fmt.Printf("  [%s] [%s] %s (metric: %.1f)\n", sev, a.Type, a.Description, a.Metric)
				}
			} else {
				fmt.Println("  No temporal anomalies detected.")
			}
			fmt.Println()
		}
	} else {
		fmt.Println("═══ Temporal Anomaly Detection ═══")
		fmt.Println("  Requires data from at least 2 epochs — skipping.")
		fmt.Println()
	}

	// Multi-layer scoring for latest epoch
	latestEpoch := history[len(history)-1].Epoch
	fmt.Printf("═══ Multi-Layer Scoring (Epoch %d) ═══\n", latestEpoch)

	rewards, err := octant.GetProjectRewards(ctx, latestEpoch)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Warning: could not fetch rewards: %v\n", err)
	} else {
		// Build ProjectMetrics for all projects in this epoch
		var metrics []analysis.ProjectMetrics
		for _, r := range rewards {
			alloc := analysis.WeiToEth(r.Allocated)
			matched := analysis.WeiToEth(r.Matched)
			metrics = append(metrics, analysis.ProjectMetrics{
				Address:      r.Address,
				Allocated:    alloc,
				Matched:      matched,
				TotalFunding: alloc + matched,
			})
		}

		// Count donors per project from allocations
		latestAllocs, _ := octant.GetAllocations(ctx, latestEpoch)
		donorCounts := map[string]map[string]bool{}
		var allocDonors, allocProjects []string
		var allocAmounts []float64
		for _, a := range latestAllocs {
			if donorCounts[a.Project] == nil {
				donorCounts[a.Project] = map[string]bool{}
			}
			donorCounts[a.Project][a.Donor] = true
			allocDonors = append(allocDonors, a.Donor)
			allocProjects = append(allocProjects, a.Project)
			allocAmounts = append(allocAmounts, analysis.WeiToEth(a.Amount))
		}
		for i := range metrics {
			if dc, ok := donorCounts[metrics[i].Address]; ok {
				metrics[i].DonorCount = len(dc)
			}
		}

		// Build trust profiles
		var trustProfiles []analysis.TrustProfile
		if len(allocDonors) > 0 {
			trustProfiles = analysis.BuildTrustProfiles(allocProjects, allocAmounts, allocDonors, nil)
		}

		// Compute multi-scores
		multiScores := analysis.ComputeMultiScores(metrics, trustProfiles)

		// Find the target project's score
		normalizedAddr := strings.ToLower(address)
		found := false
		for _, ms := range multiScores {
			if strings.ToLower(ms.Address) == normalizedAddr {
				w2 := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
				fmt.Fprintf(w2, "  Funding Score\t%.1f / 100\n", ms.FundingScore)
				fmt.Fprintf(w2, "  Efficiency Score\t%.1f / 100\n", ms.EfficiencyScore)
				fmt.Fprintf(w2, "  Diversity Score\t%.1f / 100\n", ms.DiversityScore)
				fmt.Fprintf(w2, "  Consistency Score\t%.1f / 100\n", ms.ConsistencyScore)
				fmt.Fprintf(w2, "  Overall Score\t%.1f / 100\n", ms.OverallScore)
				w2.Flush()
				found = true
				break
			}
		}
		if !found {
			fmt.Printf("  Project %s not found in epoch %d rewards.\n", address, latestEpoch)
		}
	}
	fmt.Println()

	// AI trend narrative (optional)
	ai := provider.New()
	if ai.HasProviders() && len(history) >= 2 {
		fmt.Println("═══ AI Trend Narrative ═══")
		var historyLines string
		for _, h := range history {
			historyLines += fmt.Sprintf("Epoch %d: allocated=%.4f ETH, matched=%.4f ETH, donors=%d\n", h.Epoch, h.Allocated, h.Matched, h.Donors)
		}
		prompt := fmt.Sprintf(`Analyze this Octant project's funding history across epochs and provide a concise trend narrative (3-5 sentences). Focus on: funding trajectory, donor growth/decline, efficiency changes, and any red flags.

Project: %s
History:
%s

Be specific with numbers. Do not use emojis.`, address, historyLines)

		resp, err := ai.Complete(ctx, prompt, "You are a public goods funding analyst.")
		if err != nil {
			fmt.Fprintf(os.Stderr, "  AI analysis unavailable: %v\n", err)
		} else {
			fmt.Printf("  %s\n", resp.Text)
			fmt.Printf("\n  [via %s/%s]\n", resp.Provider, resp.Model)
		}
	}
}

// --- moltbook ---

func cmdMoltbook(ctx context.Context) {
	mb := social.NewMoltbookClient()
	if !mb.Available() {
		fmt.Fprintln(os.Stderr, "MOLTBOOK_API_KEY not set in .env")
		os.Exit(1)
	}

	if len(os.Args) < 3 {
		fmt.Fprintln(os.Stderr, "Usage: tessera moltbook <post|reply|status|follow> [args]")
		os.Exit(1)
	}

	sub := os.Args[2]
	switch sub {
	case "status":
		home, err := mb.GetHome(ctx)
		exitOnErr(err)
		fmt.Printf("\n  Karma: %d\n  Unread notifications: %d\n  Unread DMs: %d\n\n", home.Karma, home.UnreadNotifications, home.UnreadDMs)

	case "post":
		if len(os.Args) < 4 {
			fmt.Fprintln(os.Stderr, "Usage: tessera moltbook post <title> -d <content>")
			os.Exit(1)
		}
		title := os.Args[3]
		content := flagString("-d", 0)
		if content == "" {
			fmt.Fprintln(os.Stderr, "Error: -d <content> is required")
			os.Exit(1)
		}
		fmt.Printf("Posting: %s\n", title)
		post, err := mb.CreatePost(ctx, "general", title, content)
		exitOnErr(err)
		fmt.Printf("Posted: %s\n", post.ID)

	case "reply":
		if len(os.Args) < 4 {
			fmt.Fprintln(os.Stderr, "Usage: tessera moltbook reply <post-id> -d <content>")
			os.Exit(1)
		}
		postID := os.Args[3]
		content := flagString("-d", 0)
		if content == "" {
			fmt.Fprintln(os.Stderr, "Error: -d <content> is required")
			os.Exit(1)
		}
		err := mb.ReplyToPost(ctx, postID, content)
		exitOnErr(err)
		fmt.Println("Reply posted.")

	case "follow":
		if len(os.Args) < 4 {
			fmt.Fprintln(os.Stderr, "Usage: tessera moltbook follow <username>")
			os.Exit(1)
		}
		username := os.Args[3]
		err := mb.FollowAgent(ctx, username)
		exitOnErr(err)
		fmt.Printf("Now following %s\n", username)

	default:
		fmt.Fprintf(os.Stderr, "Unknown moltbook command: %s\n", sub)
		os.Exit(1)
	}
}

// --- heartbeat ---

func cmdHeartbeat(ctx context.Context) {
	mb := social.NewMoltbookClient()
	if !mb.Available() {
		fmt.Fprintln(os.Stderr, "MOLTBOOK_API_KEY not set in .env")
		os.Exit(1)
	}

	ai := provider.New()
	loop := false
	for _, a := range os.Args[2:] {
		if a == "--loop" {
			loop = true
		}
	}

	for {
		runHeartbeat(ctx, mb, ai)
		if !loop {
			break
		}
		fmt.Println("\nNext heartbeat in 10 minutes... (Ctrl+C to stop)")
		time.Sleep(10 * time.Minute)
	}
}

func runHeartbeat(ctx context.Context, mb *social.MoltbookClient, ai *provider.Chain) {
	fmt.Printf("[%s] Heartbeat running...\n", time.Now().Format("15:04:05"))

	// Check home
	home, err := mb.GetHome(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Failed to fetch home: %v\n", err)
		return
	}
	fmt.Printf("  Karma: %d | Notifications: %d | DMs: %d\n", home.Karma, home.UnreadNotifications, home.UnreadDMs)

	if home.UnreadNotifications == 0 {
		fmt.Println("  No new notifications.")
		return
	}

	// Fetch notifications
	notifications, err := mb.GetNotifications(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Failed to fetch notifications: %v\n", err)
		return
	}

	// Process unread notifications
	for _, n := range notifications {
		if n.Read {
			continue
		}
		fmt.Printf("  [%s] %s\n", n.Type, n.Message)

		// Auto-reply to comment notifications if AI is available
		if ai.HasProviders() && (n.Type == "comment_reply" || n.Type == "post_reply") {
			generateAutoReply(ctx, mb, ai, n)
		}
	}
}

func generateAutoReply(ctx context.Context, mb *social.MoltbookClient, ai *provider.Chain, n social.Notification) {
	prompt := fmt.Sprintf(`You are tessera-agent, an AI agent for public goods data analysis built for The Synthesis Hackathon. You analyze Octant quadratic funding data using trust-graph analysis (Jaccard similarity, Shannon entropy), mechanism simulation (QF variants, Gini coefficients), and AI-powered project evaluation.

Someone on Moltbook sent you this notification:
Type: %s
Message: %s

Write a concise, substantive reply (2-4 sentences). Be technical and data-driven. Reference Tessera's real capabilities and findings when relevant. Do not be generic — show you understand what they said. Do not use emojis.`, n.Type, n.Message)

	resp, err := ai.Complete(ctx, prompt, "You are a public goods data analyst agent on Moltbook.")
	if err != nil {
		fmt.Fprintf(os.Stderr, "  AI reply generation failed: %v\n", err)
		return
	}

	fmt.Printf("  Auto-reply generated (%s/%s): %s\n", resp.Provider, resp.Model, resp.Text[:min(100, len(resp.Text))])
}
