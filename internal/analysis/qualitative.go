package analysis

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/yeheskieltame/tessera/internal/data"
	"github.com/yeheskieltame/tessera/internal/provider"
)

const evaluationSystem = `You are an expert evaluator of public goods projects in the Ethereum ecosystem.
You assess projects across these dimensions:
1. Impact Evidence - Does the project show measurable impact?
2. Team Credibility - Is the team experienced and transparent?
3. Innovation - Does the project introduce novel approaches?
4. Sustainability - Can the project sustain itself long-term?
5. Ecosystem Alignment - Does it strengthen Ethereum/public goods?
6. Transparency - Are goals, progress, and fund usage clear?
7. Community Engagement - Is there active community involvement?
8. Risk Assessment - What are the key risks?

Provide structured, evidence-based assessments. Be specific and cite data when possible.`

type EvaluationResult struct {
	Project    string
	Evaluation string
	Model      string
	Provider   string
}

func EvaluateProject(ctx context.Context, ai *provider.Chain, name, description, extra string, githubURL string) (*EvaluationResult, error) {
	// If GitHub URL provided, fetch README + repo signals as enrichment
	var githubContext string
	if githubURL != "" {
		owner, repo, err := data.ParseGitHubURL(githubURL)
		if err == nil {
			gh := data.NewGitHubClient()
			signals := gh.CollectEvalSignals(ctx, owner, repo)
			githubContext = signals.FormatForEval()
		}
	}

	prompt := fmt.Sprintf(`Evaluate this public goods project proposal:

**Project:** %s

**Description:**
%s`, name, description)

	if githubContext != "" {
		prompt += fmt.Sprintf("\n\n**Data from GitHub Repository:**\n%s", githubContext)
	}

	if extra != "" {
		prompt += fmt.Sprintf("\n\n**Additional Context:**\n%s", extra)
	}

	prompt += `

Provide your assessment as a structured evaluation with:
1. A score (1-10) for each of these dimensions: Impact Evidence, Team Credibility, Innovation, Sustainability, Ecosystem Alignment, Transparency, Community Engagement, Risk Assessment
2. An overall score (1-100)
3. Key strengths (bullet points)
4. Key concerns (bullet points)
5. A one-paragraph summary recommendation

Format your response as:
SCORES:
- Impact Evidence: X/10
- Team Credibility: X/10
- Innovation: X/10
- Sustainability: X/10
- Ecosystem Alignment: X/10
- Transparency: X/10
- Community Engagement: X/10
- Risk Assessment: X/10
- Overall: XX/100

STRENGTHS:
- ...

CONCERNS:
- ...

RECOMMENDATION:
...`

	resp, err := ai.Complete(ctx, prompt, evaluationSystem)
	if err != nil {
		return nil, err
	}
	return &EvaluationResult{
		Project:    name,
		Evaluation: resp.Text,
		Model:      resp.Model,
		Provider:   resp.Provider,
	}, nil
}

type ComparisonResult struct {
	Comparison   string
	ProjectCount int
	Model        string
	Provider     string
}

func CompareProjects(ctx context.Context, ai *provider.Chain, projects []struct{ Name, Description string }) (*ComparisonResult, error) {
	prompt := "Compare these public goods projects for funding evaluation:\n\n"
	for _, p := range projects {
		prompt += fmt.Sprintf("### %s\n%s\n\n", p.Name, p.Description)
	}
	prompt += `Provide:
1. A comparative ranking with justification
2. Each project's unique value proposition
3. Overlap or redundancy between projects
4. Which projects complement each other
5. Funding recommendation (if you had to allocate a fixed pool)

Be specific and evidence-based.`

	resp, err := ai.Complete(ctx, prompt, evaluationSystem)
	if err != nil {
		return nil, err
	}
	return &ComparisonResult{
		Comparison:   resp.Text,
		ProjectCount: len(projects),
		Model:        resp.Model,
		Provider:     resp.Provider,
	}, nil
}

func ExtractImpactMetrics(ctx context.Context, ai *provider.Chain, text string) (*EvaluationResult, error) {
	prompt := fmt.Sprintf(`Extract all quantifiable impact metrics from this text about a public goods project:

%s

Return a structured list of metrics found:
- Metric name
- Value (number)
- Unit/context
- Time period (if mentioned)
- Confidence (high/medium/low — is this a claim or verified data?)

Also flag any metrics that seem implausible or need verification.`, text)

	resp, err := ai.Complete(ctx, prompt, evaluationSystem)
	if err != nil {
		return nil, err
	}
	return &EvaluationResult{
		Evaluation: resp.Text,
		Model:      resp.Model,
		Provider:   resp.Provider,
	}, nil
}

// NarrateTrustProfile sends the computed trust profiles to the LLM to produce
// a qualitative trust narrative: which projects have healthy donor bases, which
// show coordination risk, and actionable recommendations for evaluators.
func NarrateTrustProfile(ctx context.Context, ai *provider.Chain, profiles []TrustProfile, epoch int) (*EvaluationResult, error) {
	// Build a textual summary of the profiles for the LLM.
	summary := fmt.Sprintf("Trust graph analysis for Octant Epoch %d (%d projects):\n\n", epoch, len(profiles))
	for _, p := range profiles {
		summary += fmt.Sprintf("Project: %s\n", p.Address)
		summary += fmt.Sprintf("  Donors: %d total, %d unique\n", p.DonorCount, p.UniqueDonors)
		summary += fmt.Sprintf("  Donor Diversity (Shannon): %.3f\n", p.DonorDiversity)
		summary += fmt.Sprintf("  Whale Dependency Ratio: %.1f%%\n", p.WhaleDepRatio*100)
		summary += fmt.Sprintf("  Coordination Risk (max Jaccard): %.3f\n", p.CoordinationRisk)
		summary += fmt.Sprintf("  Repeat Donors (from prev epochs): %d\n", p.RepeatDonors)
		if len(p.Flags) > 0 {
			summary += "  Flags:\n"
			for _, f := range p.Flags {
				summary += fmt.Sprintf("    - %s\n", f)
			}
		}
		summary += "\n"
	}

	prompt := fmt.Sprintf(`Analyze the following trust graph data from Octant's quadratic funding epoch %d:

%s

Provide a structured trust narrative covering:

1. **Healthy Donor Bases** — Which projects have diverse, organic donor support? What makes their funding patterns trustworthy?

2. **Coordination Risk** — Which projects show suspicious donor overlap or concentrated funding? Explain the risk in the context of quadratic funding (where sybil/coordination can game matching).

3. **Whale Dependency** — Which projects rely heavily on a single large donor? How does this affect their sustainability and legitimacy in a public goods context?

4. **Repeat Donor Loyalty** — What does repeat donor presence signal about project quality and community trust?

5. **Recommendations** — Concrete suggestions for evaluators:
   - Which projects deserve closer scrutiny?
   - Which projects appear to have genuinely grassroots support?
   - Any structural risks to the epoch's funding allocation?

Be specific: reference project addresses and cite the numerical data.`, epoch, summary)

	const trustSystem = `You are an expert analyst of public goods funding mechanisms, specializing in quadratic funding, sybil detection, and donor behavior analysis in the Ethereum ecosystem. You assess trust and legitimacy of funding patterns using graph-theoretic metrics like donor diversity (Shannon entropy), whale dependency ratios, and Jaccard similarity for coordination detection. Provide clear, actionable insights for human evaluators.`

	resp, err := ai.Complete(ctx, prompt, trustSystem)
	if err != nil {
		return nil, err
	}
	return &EvaluationResult{
		Project:    fmt.Sprintf("Trust Graph — Epoch %d", epoch),
		Evaluation: resp.Text,
		Model:      resp.Model,
		Provider:   resp.Provider,
	}, nil
}

// AnalyzeMechanisms sends all simulation results to the LLM for analysis of
// fairness, efficiency, incentive alignment, and which mechanism best serves
// Octant's public goods funding goals.
func AnalyzeMechanisms(ctx context.Context, ai *provider.Chain, original MechanismResult, alternatives []MechanismResult, epoch int) (*EvaluationResult, error) {
	// Build the comparison table for context.
	table := CompareDistributions(original, alternatives)

	prompt := fmt.Sprintf(`You are analyzing alternative funding mechanisms for Octant Epoch %d.

Below is a quantitative comparison of the original mechanism vs alternatives, applied to real allocation data:

%s

Based on these simulation results, provide a detailed analysis covering:

1. **Fairness Analysis**: Which mechanism distributes funding most equitably? Does lower Gini always mean better outcomes for public goods?

2. **Efficiency Analysis**: Which mechanism best directs funds to high-impact projects? Consider the trade-off between equality and rewarding quality.

3. **Incentive Alignment**: How does each mechanism affect donor behavior? Which mechanism best discourages:
   - Whale domination (large donors crowding out small ones)
   - Sybil attacks (splitting donations across fake identities)
   - Free-riding (relying on others to fund public goods)

4. **Octant-Specific Recommendation**: Given Octant's mission of sustainable public goods funding through ETH staking rewards, which mechanism (or combination) would you recommend? Consider:
   - Octant's quadratic funding model with matched rewards
   - The goal of supporting diverse, impactful projects
   - Community engagement and donor participation incentives

5. **Risks & Trade-offs**: What are the downsides of switching from the current mechanism?

Provide concrete, data-driven analysis referencing the numbers above.`, epoch, table)

	const mechanismSystem = `You are an expert in mechanism design for public goods funding, with deep knowledge of quadratic funding, Octant's protocol, and game theory. Provide rigorous, evidence-based analysis.`

	resp, err := ai.Complete(ctx, prompt, mechanismSystem)
	if err != nil {
		return nil, err
	}
	return &EvaluationResult{
		Project:    fmt.Sprintf("Mechanism Analysis (Epoch %d)", epoch),
		Evaluation: resp.Text,
		Model:      resp.Model,
		Provider:   resp.Provider,
	}, nil
}

func AnalyzeSentiment(ctx context.Context, ai *provider.Chain, projectName string, discussions []string) (*EvaluationResult, error) {
	combined := ""
	limit := 10
	if len(discussions) < limit {
		limit = len(discussions)
	}
	for i := 0; i < limit; i++ {
		combined += discussions[i] + "\n---\n"
	}

	prompt := fmt.Sprintf(`Analyze community sentiment about the project "%s" from these forum discussions:

%s

Provide:
1. Overall sentiment (positive/neutral/negative with confidence %%)
2. Key themes in support
3. Key themes in criticism
4. Unresolved questions or concerns
5. Community engagement level (high/medium/low)
6. Notable quotes that capture the sentiment`, projectName, combined)

	resp, err := ai.Complete(ctx, prompt, evaluationSystem)
	if err != nil {
		return nil, err
	}
	return &EvaluationResult{
		Project:    projectName,
		Evaluation: resp.Text,
		Model:      resp.Model,
		Provider:   resp.Provider,
	}, nil
}

// --- Deep Evaluation ---

const deepEvalSystem = `You are a senior analyst specializing in longitudinal evaluation of public goods projects in the Ethereum ecosystem. You have deep expertise in quadratic funding mechanisms (Octant, Gitcoin), on-chain data interpretation, and counterfactual impact assessment. You provide nuanced, data-driven evaluations that help funding allocators make informed decisions.`

// DeepEvaluateProject performs a deep, multi-epoch evaluation of a project by
// combining its funding trajectory across epochs, donor growth trends, and
// optional OSO (Open Source Observer) metrics into a comprehensive LLM analysis.
func DeepEvaluateProject(ctx context.Context, ai *provider.Chain, address string, history []data.ProjectEpochData, osoMetrics string) (*EvaluationResult, error) {
	if len(history) == 0 {
		return nil, fmt.Errorf("no epoch data provided for project %s", address)
	}

	// Sort history by epoch to ensure chronological order
	sorted := make([]data.ProjectEpochData, len(history))
	copy(sorted, history)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Epoch < sorted[j].Epoch })

	// Build the funding trajectory table
	var table strings.Builder
	table.WriteString("| Epoch | Allocated (ETH) | Matched (ETH) | Total (ETH) | Donors |\n")
	table.WriteString("|-------|-----------------|---------------|-------------|--------|\n")

	var totalAlloc, totalMatched float64
	var totalDonors int
	for _, ep := range sorted {
		total := ep.Allocated + ep.Matched
		totalAlloc += ep.Allocated
		totalMatched += ep.Matched
		totalDonors += ep.Donors
		table.WriteString(fmt.Sprintf("| %d | %.4f | %.4f | %.4f | %d |\n",
			ep.Epoch, ep.Allocated, ep.Matched, total, ep.Donors))
	}

	// Compute growth indicators
	first := sorted[0]
	last := sorted[len(sorted)-1]
	epochSpan := last.Epoch - first.Epoch + 1

	var donorTrend string
	if len(sorted) >= 2 {
		if last.Donors > first.Donors {
			donorTrend = fmt.Sprintf("Growing (+%d donors from epoch %d to %d)", last.Donors-first.Donors, first.Epoch, last.Epoch)
		} else if last.Donors < first.Donors {
			donorTrend = fmt.Sprintf("Declining (-%d donors from epoch %d to %d)", first.Donors-last.Donors, first.Epoch, last.Epoch)
		} else {
			donorTrend = "Stable"
		}
	} else {
		donorTrend = "Single epoch — no trend available"
	}

	prompt := fmt.Sprintf(`Perform a deep evaluation of this Octant public goods project based on its multi-epoch funding history.

**Project Address:** %s
**Epochs Covered:** %d to %d (%d epochs)

## Funding Trajectory
%s

**Totals:** %.4f ETH allocated, %.4f ETH matched, %d total donor-epoch interactions
**Donor Trend:** %s`,
		address, first.Epoch, last.Epoch, epochSpan,
		table.String(),
		totalAlloc, totalMatched, totalDonors, donorTrend)

	if osoMetrics != "" {
		prompt += fmt.Sprintf("\n\n## OSO (Open Source Observer) Metrics\n%s", osoMetrics)
	}

	prompt += `

## Analysis Required

Provide a structured deep evaluation covering:

### 1. TRAJECTORY NARRATIVE
Describe the project's funding journey across epochs. Is it growing, plateauing, or declining? What does the pattern suggest about community confidence?

### 2. INFLECTION POINTS
Identify any significant changes between epochs (sudden funding jumps/drops, donor count shifts). What might have caused them?

### 3. ORGANIC vs GAMING ASSESSMENT
Based on the funding patterns and donor counts, assess the likelihood that this project's support is organic vs potentially gamed. Consider:
- Donor-to-funding ratio consistency
- Matched vs allocated proportion trends
- Any suspicious patterns

Rate: Likely Organic / Mixed Signals / Likely Gamed (with confidence %)

### 4. COUNTERFACTUAL IMPACT
Would this project's outcomes likely have occurred without Octant funding? Consider the funding dependency and what the allocated amounts suggest about community willingness to fund.

### 5. CONFIDENCE-RATED RECOMMENDATION
Provide a final recommendation with confidence rating:
- Funding Worthiness: Strong Support / Support / Neutral / Caution / Oppose
- Confidence: High / Medium / Low
- Key factors driving the recommendation
- Specific conditions or caveats`

	resp, err := ai.Complete(ctx, prompt, deepEvalSystem)
	if err != nil {
		return nil, err
	}
	return &EvaluationResult{
		Project:    address,
		Evaluation: resp.Text,
		Model:      resp.Model,
		Provider:   resp.Provider,
	}, nil
}

// --- Proposal Scanning ---

const proposalScanSystem = `You are a fact-checking analyst specializing in public goods project proposals. You extract and verify factual claims with precision, distinguishing between verifiable metrics, team claims, impact assertions, and timeline commitments. You are thorough, skeptical, and fair.`

// ScanProposal performs a two-pass LLM analysis of a project proposal:
//   - Pass 1: Extract all factual claims from the proposal text
//   - Pass 2: Cross-reference extracted claims against realData (verified metrics)
//     to produce a verification report
func ScanProposal(ctx context.Context, ai *provider.Chain, name, description string, realData map[string]string) (*EvaluationResult, error) {
	// --- Pass 1: Extract factual claims ---

	extractPrompt := fmt.Sprintf(`Extract ALL factual claims from this public goods project proposal. Be exhaustive.

**Project:** %s

**Proposal Text:**
%s

For each claim, provide:
- The exact claim text (quoted from the proposal)
- Claim type: one of [metric, team, impact, timeline, technical, financial, partnership]
- What evidence would be needed to verify this claim

Format as a numbered list:
1. CLAIM: "..."
   TYPE: ...
   VERIFICATION NEEDED: ...

Extract every verifiable statement, including numbers, dates, team credentials, partnerships, user counts, funding amounts, and impact claims.`, name, description)

	pass1Resp, err := ai.Complete(ctx, extractPrompt, proposalScanSystem)
	if err != nil {
		return nil, fmt.Errorf("scan-proposal pass 1 (claim extraction) failed: %w", err)
	}

	// --- Pass 2: Verify claims against real data ---

	var realDataSection strings.Builder
	if len(realData) > 0 {
		realDataSection.WriteString("## Verified Data Points\n")
		realDataSection.WriteString("These are independently verified metrics and facts:\n\n")
		// Sort keys for deterministic output
		keys := make([]string, 0, len(realData))
		for k := range realData {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			realDataSection.WriteString(fmt.Sprintf("- **%s:** %s\n", k, realData[k]))
		}
	} else {
		realDataSection.WriteString("## Verified Data Points\nNo independently verified data was provided for cross-reference.\n")
	}

	verifyPrompt := fmt.Sprintf(`You previously extracted factual claims from the project "%s". Now cross-reference them against verified data to produce a verification report.

## Extracted Claims (from Pass 1)
%s

%s

## Verification Report Instructions

For each extracted claim, categorize it as one of:
- **SUPPORTED** — The claim is consistent with verified data. Cite the matching data point.
- **CONTRADICTED** — The claim conflicts with verified data. Cite the contradicting data point and explain the discrepancy.
- **UNVERIFIABLE** — No verified data is available to confirm or deny this claim.
- **PARTIALLY SUPPORTED** — Some aspects match but others cannot be verified or show discrepancies.

Format your report as:

### VERIFICATION SUMMARY
- Total claims: N
- Supported: N
- Contradicted: N
- Unverifiable: N
- Partially Supported: N
- Trust Score: X/100 (based on ratio of supported vs contradicted claims, weighted by significance)

### DETAILED FINDINGS

For each claim:
1. CLAIM: "..."
   STATUS: SUPPORTED/CONTRADICTED/UNVERIFIABLE/PARTIALLY SUPPORTED
   EVIDENCE: ...
   SIGNIFICANCE: High/Medium/Low

### RED FLAGS
List any claims that are clearly contradicted or suspiciously inflated.

### ASSESSMENT
A brief paragraph on the overall trustworthiness of this proposal based on the verification results.`,
		name, pass1Resp.Text, realDataSection.String())

	pass2Resp, err := ai.Complete(ctx, verifyPrompt, proposalScanSystem)
	if err != nil {
		return nil, fmt.Errorf("scan-proposal pass 2 (verification) failed: %w", err)
	}

	// Combine both passes into the final evaluation
	combined := fmt.Sprintf("# Proposal Scan: %s\n\n## Pass 1: Extracted Claims\n\n%s\n\n---\n\n## Pass 2: Verification Report\n\n%s",
		name, pass1Resp.Text, pass2Resp.Text)

	// Use the model/provider from pass 2 as the primary attribution
	return &EvaluationResult{
		Project:    name,
		Evaluation: combined,
		Model:      pass2Resp.Model,
		Provider:   pass2Resp.Provider,
	}, nil
}
