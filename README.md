# Tessera

**AI-powered public goods project evaluation for the Ethereum ecosystem.**

Tessera analyzes projects funded by [Octant](https://octant.build), [Gitcoin](https://gitcoin.co), and other public goods platforms — combining quantitative data analysis with qualitative AI assessment to surface patterns that human evaluators cannot scale alone.

Named after the Latin word for *mosaic piece*: assembling fragments of data into a complete picture.

---

## What It Does

**Quantitative Analysis**
- K-means clustering to group projects by funding profile
- Composite scoring (0–100) normalized across the dataset
- Whale concentration detection (top 10% donor share)
- Coordinated donation pattern flagging

**Qualitative Analysis (AI-powered)**
- 8-dimension project evaluation (Impact, Team, Innovation, Sustainability, Ecosystem Alignment, Transparency, Community, Risk)
- Multi-project comparison with funding recommendations
- Community sentiment analysis from forum discussions
- Impact metric extraction from unstructured text

**Data Sources**
- [Octant API](https://docs.octant.app) — projects, allocations, rewards, epochs
- [Gitcoin Grants Stack](https://grants-stack-indexer-v2.gitcoin.co/graphiql) — rounds, donations, matching
- [Open Source Observer](https://www.opensource.observer) — GitHub metrics, on-chain activity

---

## Quick Start

### Prerequisites

- [Go 1.21+](https://go.dev/dl/)
- At least one AI API key (for qualitative analysis features)

### Build

```bash
git clone https://github.com/yeheskieltame/Tessera.git
cd Tessera
go build -o tessera ./cmd/analyst/
```

### Configure

Create a `.env` file in the project root:

```bash
# AI Providers — at least one required for qualitative features
# Providers are tried in order; if one fails, the next is used automatically
ANTHROPIC_API_KEY=sk-ant-...       # Claude (primary)
GEMINI_API_KEY=...                  # Google Gemini (fallback 1)
OPENAI_API_KEY=sk-...               # OpenAI GPT (fallback 2)
ANTIGRAVITY_URL=http://localhost:8080  # Antigravity proxy (fallback 3)

# Optional: override default models
CLAUDE_MODEL=claude-sonnet-4-6
GEMINI_MODEL=gemini-2.0-flash
OPENAI_MODEL=gpt-4o

# Optional: Open Source Observer API key
OSO_API_KEY=...
```

Quantitative commands (`list-projects`, `analyze-epoch`, `detect-anomalies`) work without any API keys — they pull directly from public data sources.

### Verify Setup

```bash
./tessera status
```

Expected output:
```
  SERVICE          STATUS
  -------          ------
  Octant API       ✓ epoch 12
  Gitcoin GraphQL  ✓ 1 rounds
  OSO API          ✓ connected
  AI Providers     2 configured
```

---

## Usage

### List Octant projects for an epoch

```bash
./tessera list-projects -e 5
```

### Analyze an epoch (clustering + scoring)

```bash
./tessera analyze-epoch -e 5
```

Output includes ranked projects with composite scores, allocated/matched ETH, and cluster assignments.

### Detect funding anomalies

```bash
./tessera detect-anomalies -e 5
```

Flags whale concentration and coordinated donation patterns. Example finding: *"Top 10% of donors control 97.9% of total funding"* in Epoch 5.

### Evaluate a project with AI

```bash
./tessera evaluate "Project Name" -d "Description of what the project does"
```

Returns an 8-dimension scored evaluation with strengths, concerns, and a recommendation. Report is saved to `reports/`.

### Extract impact metrics from text

```bash
./tessera extract-metrics "The project served 50,000 users and processed $2M in transactions over 6 months"
```

### Analyze a Gitcoin Grants round

```bash
./tessera gitcoin-rounds -r "ROUND_ID" --chain 1
```

### Show AI provider fallback chain

```bash
./tessera providers
```

---

## Architecture

```
Tessera/
├── cmd/analyst/main.go           # CLI entry point
├── internal/
│   ├── provider/provider.go      # Multi-model AI fallback chain
│   ├── data/
│   │   ├── octant.go             # Octant REST API client
│   │   ├── gitcoin.go            # Gitcoin GraphQL client
│   │   └── oso.go                # Open Source Observer client
│   ├── analysis/
│   │   ├── quantitative.go       # K-means, scoring, anomaly detection
│   │   └── qualitative.go        # LLM evaluation, comparison, sentiment
│   └── report/report.go          # Markdown report generation
└── skills/
    └── public-goods-analyst/
        └── SKILL.md              # OpenClaw skill definition
```

**Single binary (~9MB)**, zero runtime dependencies, <5ms startup.

### Multi-Model Fallback

Tessera tries AI providers in order. If one fails (rate limit, network error, invalid key), it automatically falls back to the next:

1. **Claude** (Anthropic API)
2. **Gemini** (Google AI)
3. **OpenAI** (GPT)
4. **Antigravity** (Claude via proxy)

### OpenClaw Skill

Tessera ships as an [OpenClaw](https://openclaw.ai) skill, making it usable from OpenClaw, Claude Code, and Gemini CLI. The skill definition is in `skills/public-goods-analyst/SKILL.md`.

---

## Why Tessera?

Public goods evaluators face real problems:

| Problem | How Tessera Helps |
|---------|-------------------|
| **Cognitive overload** — too many projects to evaluate | Automated scoring and clustering across all projects in an epoch |
| **Qualitative data doesn't scale** — can't read every proposal | AI evaluates proposals across 8 dimensions in seconds |
| **Sybil attacks** on quadratic funding | Detects coordinated donation patterns |
| **Whale concentration** distorts funding | Measures top-donor share and flags imbalances |
| **No counterfactual measurement** | Extracts and structures impact metrics for comparison |

---

## Built For

**The Synthesis** — a 14-day hackathon where AI agents and humans build together as equals.

- **Track:** Agents for Public Goods Data Analysis for Project Evaluation (Octant, $1000)
- **Human:** Yeheskiel Yunus Rame ([@YeheskielTame](https://x.com/YeheskielTame))
- **Agent:** Claude Opus 4.6 via Claude Code

See [CONVERSATION_LOG.md](CONVERSATION_LOG.md) for the full human-agent collaboration history.

---

## License

MIT
