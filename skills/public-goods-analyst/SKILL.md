---
name: public-goods-analyst
description: AI-powered public goods evaluation agent with 20 CLI commands and 11-step evidence pipeline. Collects from 9 data sources (Octant, Gitcoin, OSO, GitHub, 9 EVM chains, Block Explorers, Octant Discourse, Optimism RetroPGF, Optimism Gov). Signal Quality Framework classifies every signal as HIGH/MEDIUM/LOW reliability. Adaptive collection loop auto-discovers missing data. Signal corroboration cross-verifies claims. Donor behavior profiling. Trust-graph (Jaccard, Shannon entropy, union-find), mechanism simulation (4 QF variants including novel Trust-Weighted QF), temporal anomaly detection, multi-layer scoring, branded PDF reports. Default AI: claude-opus-4-6.
homepage: https://yeheskieltame-tessera.hf.space
user-invocable: true
disable-model-invocation: false
command-dispatch: tool
command-tool: Bash
command-arg-mode: raw
metadata: {"openclaw": {"always": false, "os": ["darwin", "linux"], "requires": {"bins": ["tessera"]}, "primaryEnv": "MOLTBOOK_API_KEY", "skillKey": "public-goods-analyst", "homepage": "https://github.com/yeheskieltame/Tessera", "install": [{"id": "go-build", "kind": "shell", "command": "go build -o tessera ./cmd/analyst/", "os": ["darwin", "linux"]}]}}
---

# Tessera — Public Goods Analyst

AI-powered public goods project evaluation for the Ethereum ecosystem. 20 CLI commands with an **11-step evidence pipeline** collecting from **9 independent data sources**. Features Signal Quality Framework (HIGH/MEDIUM/LOW reliability), adaptive collection loop, signal corroboration (7 cross-verification checks), donor behavior profiling, trust-graph analysis, mechanism simulation (4 QF variants), temporal anomaly detection, multi-chain blockchain scanning (9 EVM chains), community discourse analysis (Octant forum), cross-ecosystem validation (Optimism RetroPGF), branded PDF reports, and social interaction.

Built in Go — single 9MB binary, zero runtime dependencies.

**Live Demo:** https://yeheskieltame-tessera.hf.space | **GitHub:** https://github.com/yeheskieltame/Tessera

## When to Use This Skill

Use this skill when the user asks about:
- Evaluating public goods projects (Octant, Gitcoin, or any Ethereum project)
- Analyzing Octant epoch data (funding, allocations, rewards)
- Detecting funding anomalies, whale concentration, or sybil patterns
- Comparing funding mechanisms (quadratic funding variants)
- Building trust profiles from donor behavior
- Scanning an address across multiple EVM blockchains
- Checking USDC/USDT/DAI balances across chains
- Extracting impact metrics from project descriptions
- Cross-referencing funding data with GitHub/on-chain activity
- Generating comprehensive evaluation reports
- Interacting on Moltbook (AI agent social network)

## Setup

**Recommended (Claude Max plan, no API key needed):**
```bash
npm i -g @anthropic-ai/claude-code
claude login
```

**Alternative (API key):**
```bash
cp .env.example .env
# Set at least one: ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY
```

Quantitative commands and blockchain scanning work without any AI provider.

## Commands

### The Two Main Operations

```bash
# Full 9-step intelligence pipeline (one command, all data)
./tessera analyze-project <address> [-e <epoch>] [-n <oso-name>]

# AI qualitative evaluation with optional GitHub enrichment
./tessera evaluate "Project Name" -d "Description" [-g "github-url"]
```

**`analyze-project`** automatically:
1. Fetches cross-epoch funding history
2. Computes quantitative ranking and composite score
3. Builds trust profile (donor diversity, whale dependency, coordination risk)
4. Simulates mechanism impact (4 QF variants)
5. Detects temporal anomalies
6. Computes multi-layer scores (5 dimensions)
7. **Scans address across 9 EVM chains** (balance, txs, contracts, USDC/USDT/DAI)
8. Collects OSO signals if `-n` provided
9. Generates AI deep evaluation combining all data + PDF report

**`evaluate`** scores across 8 dimensions: Impact, Team, Innovation, Sustainability, Ecosystem, Transparency, Community, Risk. Enriches with GitHub README + repo metrics if `-g` provided. Generates PDF report.

### Quantitative Analysis (no AI needed)

```bash
./tessera status                    # Check connectivity (Octant, Gitcoin, OSO, 9 blockchain RPCs, AI)
./tessera providers                 # Show AI provider chain
./tessera list-projects -e 5        # List Octant projects for epoch 5
./tessera analyze-epoch -e 5        # K-means clustering + composite scoring
./tessera detect-anomalies -e 5     # Whale concentration + coordinated patterns
./tessera trust-graph -e 5          # Donor diversity, Jaccard similarity, coordination risk
./tessera simulate -e 5             # Compare 4 QF mechanisms
./tessera track-project <addr>      # Cross-epoch timeline + temporal anomalies
./tessera scan-chain <addr>         # Scan address across 9 EVM chains (balance, txs, USDC/USDT/DAI)
./tessera gitcoin-rounds -r ID      # Analyze Gitcoin round
```

### Qualitative Analysis (requires AI)

```bash
./tessera deep-eval <addr> [-n name]      # Multi-epoch deep evaluation
./tessera scan-proposal "Name" -d "text"  # Two-pass proposal verification
./tessera extract-metrics "text"          # Extract impact metrics from text
./tessera report-epoch -e 5               # Full epoch intelligence report
./tessera collect-signals <name-or-repo>  # OSO + GitHub + blockchain signals
```

### Social (Moltbook) & Server

```bash
./tessera moltbook status           # Agent karma, notifications
./tessera moltbook post "Title" -d "Content"
./tessera heartbeat [--loop]        # Autonomous notification check
./tessera serve                     # Web dashboard at http://localhost:8080
```

### Chat Agent (Human-to-Agent and Agent-to-Agent)

The agent can be interacted with via natural language chat, both from the web UI (floating bubble on all pages) and programmatically via API.

**Human-to-Agent:** Open the chat bubble on any page, type a question or command.

**Agent-to-Agent (API):**

```bash
# Basic query
curl -X POST https://yeheskieltame-tessera.hf.space/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "analyze epoch 5"}'

# Structured JSON response
curl -X POST https://yeheskieltame-tessera.hf.space/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "whale concentration epoch 5", "format": "json"}'

# Full analysis with PDF report
curl -X POST https://yeheskieltame-tessera.hf.space/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "analyze project 0x9531C059098e3d194fF87FebB587aB07B30B1306"}'

# Download generated PDF
curl -O https://yeheskieltame-tessera.hf.space/api/reports/intelligence_report__0x9531c0.pdf
```

**Response format:**

```json
{
  "reply": "analysis text with real data...",
  "model": "gemini-2.5-flash",
  "provider": "gemini",
  "command": "analyze-epoch",
  "reportPath": "reports/intelligence_report__0x9531c0.pdf"
}
```

The agent detects intent from natural language, executes commands internally (fetches real data from Octant API, blockchain RPCs, analysis engine), and returns narrated results. If AI is unavailable, raw data is returned with `"provider": "direct-data"`.

## AI Provider Chain

| Priority | Provider | Activation |
|----------|----------|------------|
| 1 | Claude CLI | `claude` binary on PATH (Max plan) |
| 2 | Claude API | `ANTHROPIC_API_KEY` set |
| 3 | Gemini | `GEMINI_API_KEY` set |
| 4 | OpenAI | `OPENAI_API_KEY` set |

## Data Sources

| Source | Protocol | Data |
|--------|----------|------|
| Octant | REST | Projects, allocations, rewards, epochs, patrons, budgets |
| Gitcoin | GraphQL | Rounds, applications, donations, matching |
| OSO | GraphQL | GitHub metrics, on-chain activity, funding |
| **Blockchain RPC** | JSON-RPC | Balance, txs, contracts, ERC-20 tokens (9 chains) |
| **Block Explorers** | REST | Recent txs, token transfers, contract verification |
| GitHub | REST | Repo metrics, contributors, README |
| Moltbook | REST | Posts, comments, notifications |

## Multi-Chain Blockchain Support

Scans 9 EVM chains concurrently (~2-3 seconds):
- **Mainnets:** Ethereum, Base, Optimism, Arbitrum, Mantle, Scroll, Linea, zkSync Era
- **Testnets:** Monad
- **Tokens tracked:** USDC (6 decimals), USDT (6 decimals), DAI (18 decimals)
- **Per-chain:** native balance, tx count, contract detection, token balances, recent txs

## Key Findings (Real Data)

- 97.9% whale concentration across epochs (92-98% systemic)
- **41 donor coordination clusters** (Jaccard > 0.7), increasing: 25 (E4) to 44 (E6)
- Rank #1 project (composite 89.5) drops to **36.6 Overall** under multi-layer scoring
- Single whale **0x2585** controls 90-99% of 5 projects simultaneously
- Equal Weight mechanism: **+3105%** for smallest project, **-73%** for rank #1

See [FINDINGS.md](FINDINGS.md) for detailed analysis.

## How to Interpret Results

- **Composite Scores**: 0-100, weighted 40% allocated + 60% matched
- **Donor Diversity**: Shannon entropy 0-1 (0 = single donor, 1 = perfectly even)
- **Whale Dependency**: Fraction from top donor (>50% = flagged)
- **Coordination Risk**: Max Jaccard similarity (>0.7 = flagged)
- **Gini Coefficient**: 0 = equality, 1 = one project gets everything
- **Trust-Weighted QF**: Multiplier = 0.5 + 0.5 × diversity_score
- **Token Balances**: USDC/USDT in 6 decimals, DAI in 18 decimals

## Building from Source

```bash
go build -o tessera ./cmd/analyst/
```

Requires Go 1.21+. Produces a single ~9MB binary with zero dependencies.
