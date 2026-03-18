package main

import (
	"context"
	"fmt"
	"math/big"
	"os"
	"sort"
	"strings"
	"text/tabwriter"

	"github.com/yeheskieltame/tessera/internal/analysis"
	"github.com/yeheskieltame/tessera/internal/data"
	"github.com/yeheskieltame/tessera/internal/provider"
	"github.com/yeheskieltame/tessera/internal/report"
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
    <text>              Text to analyze (required)`)
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

	fmt.Println("\n══════ Extracted Impact Metrics ══════\n")
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
