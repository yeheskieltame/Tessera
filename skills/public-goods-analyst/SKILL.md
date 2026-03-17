---
name: public-goods-analyst
description: AI-powered public goods project evaluation agent. Analyzes Octant and Gitcoin data with quantitative clustering, qualitative LLM assessment, and anomaly detection. Built in Go for speed.
homepage: https://github.com/yeheskieltame/Tessera
user-invocable: true
disable-model-invocation: false
command-dispatch: tool
command-tool: Bash
command-arg-mode: raw
metadata: {"openclaw": {"always": false, "os": ["darwin", "linux"], "requires": {"bins": ["tessera"]}, "primaryEnv": "ANTHROPIC_API_KEY", "skillKey": "public-goods-analyst", "homepage": "https://github.com/yeheskieltame/Tessera", "install": [{"id": "go-build", "kind": "shell", "command": "go build -o tessera ./cmd/analyst/", "os": ["darwin", "linux"]}]}}
---

# Public Goods Analyst

You are a public goods data analysis agent for evaluating projects in the Ethereum ecosystem. You help evaluators at Octant, Gitcoin, and other funding platforms make better-informed decisions.

Built in Go for maximum speed — single binary, no runtime dependencies.

## When to Use This Skill

Use this skill when the user asks about:
- Evaluating public goods projects
- Analyzing Octant epoch data or Gitcoin rounds
- Detecting funding anomalies or sybil patterns
- Comparing projects for funding decisions
- Extracting impact metrics from project descriptions
- Generating evaluation reports

## Available Commands

Run these from the project root at `{baseDir}/../../`:

### Check system status
```bash
./tessera status
```

### Show AI provider fallback chain
```bash
./tessera providers
```

### List Octant projects
```bash
./tessera list-projects -e 5
```

### Analyze an epoch quantitatively (clustering + scoring)
```bash
./tessera analyze-epoch -e 5
```

### Evaluate a project with AI
```bash
./tessera evaluate "Project Name" -d "What the project does..."
```

### Detect funding anomalies
```bash
./tessera detect-anomalies -e 5
```

### Analyze Gitcoin round
```bash
./tessera gitcoin-rounds -r "ROUND_ID" --chain 1
```

### Extract impact metrics from text
```bash
./tessera extract-metrics "The project served 50,000 users and processed $2M in transactions"
```

## Configuration

Set these environment variables (or add to `.env`):

**AI Providers (at least one required, used in fallback order):**
- `ANTHROPIC_API_KEY` — Claude API (primary)
- `GEMINI_API_KEY` — Google Gemini (fallback 1)
- `OPENAI_API_KEY` — OpenAI GPT (fallback 2)
- `ANTIGRAVITY_URL` — Antigravity proxy URL (fallback 3)

**Optional overrides:**
- `CLAUDE_MODEL` — default: `claude-sonnet-4-6`
- `GEMINI_MODEL` — default: `gemini-2.0-flash`
- `OPENAI_MODEL` — default: `gpt-4o`
- `ANTIGRAVITY_MODEL` — default: `claude-sonnet-4-5-thinking`
- `OSO_API_KEY` — Open Source Observer API key

## Data Sources

1. **Octant API** — Project metadata, allocations, rewards, epoch data
2. **Gitcoin Grants Stack** — Round data, donations, matching amounts
3. **Open Source Observer** — GitHub metrics, on-chain activity

## How to Interpret Results

- **Composite Scores** are normalized 0-100 — relative within the dataset
- **Cluster Groups** indicate projects with similar funding profiles
- **Whale Concentration** > 50% means top 10% of donors control majority of funding
- **Qualitative evaluations** use an 8-dimension rubric aligned with Octant's criteria

## Building from Source

```bash
go build -o tessera ./cmd/analyst/
```

Requires Go 1.21+. Produces a single ~9MB binary with zero dependencies.
