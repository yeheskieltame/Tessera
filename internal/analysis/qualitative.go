package analysis

import (
	"context"
	"fmt"

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

func EvaluateProject(ctx context.Context, ai *provider.Chain, name, description, extra string) (*EvaluationResult, error) {
	prompt := fmt.Sprintf(`Evaluate this public goods project proposal:

**Project:** %s

**Description:**
%s`, name, description)

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
