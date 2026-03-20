---
name: public-goods-analyst
description: AI-powered public goods evaluation agent with 19 CLI commands and 8-step evidence pipeline. Trust-graph (Jaccard, Shannon entropy, union-find), mechanism simulation (4 QF variants including novel Trust-Weighted QF), temporal anomaly detection, multi-layer scoring (5 dimensions), branded PDF reports for both analyze-project and evaluate commands, GitHub README enrichment for evaluate. Default AI: claude-opus-4-6.
homepage: https://github.com/yeheskieltame/Tessera
user-invocable: true
disable-model-invocation: false
command-dispatch: tool
command-tool: Bash
command-arg-mode: raw
metadata: {"openclaw": {"always": false, "os": ["darwin", "linux"], "requires": {"bins": ["tessera"]}, "primaryEnv": "MOLTBOOK_API_KEY", "skillKey": "public-goods-analyst", "homepage": "https://github.com/yeheskieltame/Tessera", "install": [{"id": "go-build", "kind": "shell", "command": "go build -o tessera ./cmd/analyst/", "os": ["darwin", "linux"]}]}}
---

# Tessera — Public Goods Analyst

AI-powered public goods project evaluation for the Ethereum ecosystem. 19 CLI commands with an 8-step evidence pipeline. Covers quantitative analysis, qualitative AI assessment, mechanism design simulation, temporal anomaly detection, multi-layer scoring, data collection, branded PDF reports, and social interaction.

Built in Go — single 9MB binary, zero runtime dependencies.

## When to Use This Skill

Use this skill when the user asks about:
- Evaluating public goods projects (Octant, Gitcoin, or any Ethereum project)
- Analyzing Octant epoch data (funding, allocations, rewards)
- Detecting funding anomalies, whale concentration, or sybil patterns
- Comparing funding mechanisms (quadratic funding variants)
- Building trust profiles from donor behavior
- Extracting impact metrics from project descriptions
- Cross-referencing funding data with GitHub/on-chain activity
- Generating comprehensive evaluation reports
- Interacting on Moltbook (AI agent social network)

## Setup

**Recommended (Claude Max plan, no API key needed):**
```bash
# Just install Claude Code — Tessera auto-detects it
npm i -g @anthropic-ai/claude-code
claude login
```

**Alternative (API key):**
```bash
cp .env.example .env
# Set at least one: ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY
```

**For Moltbook features:**
```bash
# Add to .env:
MOLTBOOK_API_KEY=moltbook_sk_...
```

Quantitative commands work without any AI provider. Qualitative commands require Claude CLI or an API key.

## Commands

### The Killer Demo (one command, full intelligence)

```bash
./tessera analyze-project <address> [-e <epoch>] [-n <oso-name>]
```

Given a single Octant project address, automatically:
1. Fetches cross-epoch funding history (all epochs)
2. Computes quantitative ranking and composite score
3. Builds trust profile (donor diversity, whale dependency, coordination risk)
4. Simulates mechanism impact (Standard QF, Capped QF, Equal Weight, Trust-Weighted QF)
5. Collects OSO signals if `-n` provided (GitHub, on-chain, funding)
6. Generates AI deep evaluation combining all data

Output: comprehensive intelligence report with trajectory narrative, inflection points, organic vs gaming assessment, counterfactual impact, and confidence-rated recommendation.

### Quantitative Analysis (no AI needed)

```bash
# Check connectivity to all data sources
./tessera status

# Show AI provider fallback chain
./tessera providers

# List Octant projects for an epoch
./tessera list-projects -e 5

# Full quantitative analysis: K-means clustering + composite scoring
./tessera analyze-epoch -e 5

# Detect whale concentration + coordinated donation patterns
./tessera detect-anomalies -e 5

# Analyze Gitcoin Grants round
./tessera gitcoin-rounds -r "ROUND_ID" --chain 1
```

### Trust Graph Analysis

```bash
# Build donor-project bipartite graph for an epoch
./tessera trust-graph -e 5
```

Computes per-project: donor diversity (Shannon entropy), whale dependency ratio, coordination risk (Jaccard similarity), repeat donor loyalty. Detects donor clusters using union-find. Generates AI trust narrative.

### Mechanism Design Simulation

```bash
# Compare 4 funding mechanisms with real allocation data
./tessera simulate -e 5
```

Simulates: Standard QF, Capped QF (10% per-donor cap), Equal Weight (1-person-1-vote), and Trust-Weighted QF (novel mechanism using donor diversity as QF multiplier). Outputs Gini coefficients, distribution comparison, per-project impact table, and AI mechanism analysis.

### Qualitative AI Analysis (requires AI provider)

```bash
# 8-dimension project evaluation with optional GitHub enrichment + PDF report
./tessera evaluate "Project Name" -d "Description" [-c "Context"] [-g "github-url"]

# Multi-epoch deep evaluation with trajectory analysis
./tessera deep-eval <address> [-n <oso-name>]

# Two-pass proposal claim extraction + verification
./tessera scan-proposal "Project Name" -d "Full proposal text"

# Extract structured impact metrics from text
./tessera extract-metrics "The project served 50,000 users..."

# Full epoch intelligence report (all analyses combined)
./tessera report-epoch -e 5
```

### Track Project (Cross-Epoch + Temporal Anomaly)

```bash
# Track project across all epochs with temporal anomaly detection
./tessera track-project <address>
```

Outputs: cross-epoch timeline, temporal anomalies (donor surge, exodus, funding spike, new whale, coordination shift), and multi-layer scores (Funding, Efficiency, Diversity, Consistency, Overall).

### Data Collection (OSO + GitHub)

```bash
# Collect signals from OSO and GitHub API
./tessera collect-signals <project-name-or-owner/repo>
# Examples:
./tessera collect-signals golemfoundation/octant
./tessera collect-signals rotki/rotki
```

Tries OSO first (code metrics, on-chain, funding), falls back to GitHub API (stars, forks, commits, contributors). Accepts both project names and owner/repo format.

### Social (Moltbook)

```bash
# Check agent status (karma, notifications, DMs)
./tessera moltbook status

# Create a post
./tessera moltbook post "Title" -d "Content"

# Reply to a post
./tessera moltbook reply <post-id> -d "Reply content"

# Follow another agent
./tessera moltbook follow <username>

# Autonomous heartbeat (check notifications, AI auto-reply)
./tessera heartbeat

# Continuous monitoring every 10 minutes
./tessera heartbeat --loop
```

### Web Dashboard

```bash
# Start web server with dashboard UI
./tessera serve
# Open http://localhost:8080
```

Serves a Next.js dashboard with all analysis features, SSE real-time streaming for long operations, and inline PDF report viewer.

## AI Provider Chain

Tessera tries providers in order. First available wins:

| Priority | Provider | Activation |
|----------|----------|------------|
| 1 | Claude CLI | `claude` binary on PATH (Max plan, no key needed) |
| 2 | Claude API | `ANTHROPIC_API_KEY` set |
| 3 | Gemini | `GEMINI_API_KEY` set |
| 4 | OpenAI | `OPENAI_API_KEY` set |

Default model: `claude-opus-4-6`. Override with `CLAUDE_CLI_MODEL`.

## Data Sources

| Source | Protocol | Data |
|--------|----------|------|
| Octant | REST | Projects, allocations, rewards, epochs, patrons, budgets, leverage, threshold |
| Gitcoin | GraphQL | Rounds, applications, donations, matching |
| OSO | GraphQL | GitHub metrics, on-chain activity, funding, timeseries |
| Moltbook | REST | Posts, comments, notifications, agent profiles |

## Key Findings (Real Data)

From real Octant data analysis:
- 97.9% whale concentration across epochs (92-98% systemic)
- **41 donor coordination clusters** (Jaccard > 0.7), increasing: 25 (E4) to 44 (E6)
- Rank #1 project (composite 89.5) drops to **36.6 Overall** under multi-layer scoring (Diversity: 10.9, Efficiency: 5.9)
- Single whale **0x2585** controls 90-99% of 5 projects simultaneously
- 11 temporal anomalies in one epoch transition including 931% funding spike
- Healthiest project (Shannon 0.892, whale 13.4%) ranks only 27/30 by funding
- Equal Weight mechanism: **+3105%** for smallest project, **-73%** for rank #1
- Donor coordination clusters **increasing over time** (25 to 44 across 3 epochs)

See [FINDINGS.md](FINDINGS.md) for detailed analysis with reproducible commands.

**Known limitation:** OSO GraphQL API is currently experiencing infrastructure outage. GitHub API fallback provides code metrics independently.

## How to Interpret Results

- **Composite Scores**: Normalized 0-100, weighted 40% allocated + 60% matched
- **Cluster Groups**: K-means assignment (similar funding profiles)
- **Donor Diversity**: Shannon entropy 0-1 (0 = single donor, 1 = perfectly even)
- **Whale Dependency**: Fraction of funding from top donor (>50% = flagged)
- **Coordination Risk**: Max Jaccard similarity with any other project's donor set (>0.7 = flagged)
- **Gini Coefficient**: 0 = perfect equality, 1 = one project gets everything
- **Trust-Weighted QF**: Multiplier = 0.5 + 0.5 * diversity_score (low-trust projects lose up to 50%)

## Building from Source

```bash
go build -o tessera ./cmd/analyst/
```

Requires Go 1.21+. Produces a single ~9MB binary with zero dependencies.
