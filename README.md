# Tessera

<p align="center">
  <img src="frontend/public/tessera-icon-256.png" alt="Tessera" width="128" />
</p>

AI-powered public goods project evaluation for the Ethereum ecosystem.

_Named after the Latin word for "mosaic piece" — assembling fragments of on-chain data, funding records, blockchain activity, and community signals into a complete picture of project health._

---

## What It Does

Tessera is a CLI tool (20 commands) and web dashboard that evaluates projects funded through Octant, Gitcoin, and other Ethereum public goods platforms. It has **two primary operations** that each run a comprehensive pipeline in a single command:

**`analyze-project <address>`** — Given an Octant project address, runs a 9-step evidence pipeline: cross-epoch funding history, quantitative scoring (K-means), trust-graph analysis (Jaccard, Shannon entropy), mechanism simulation (4 QF variants including novel Trust-Weighted QF), temporal anomaly detection, multi-layer scoring (5 dimensions), **multi-chain blockchain scan** (9 EVM chains + USDC/USDT/DAI token balances), OSO data collection, and AI deep evaluation. Generates a branded PDF report.

**`evaluate "Name" -d "Desc" [-g github-url]`** — Evaluates any public goods project across 8 dimensions (Impact, Team, Innovation, Sustainability, Ecosystem, Transparency, Community, Risk) using AI. Optionally enriches with GitHub README + repo metrics. Generates a branded PDF report.

Both operations are accessible from the web dashboard with a single button click.

---

## Quick Start

```bash
git clone https://github.com/yeheskieltame/Tessera.git
cd Tessera
go build -o tessera ./cmd/analyst/
./tessera serve    # Web UI at http://localhost:8080
```

For AI-powered features (Claude Max plan, no API key needed):

```bash
npm i -g @anthropic-ai/claude-code && claude login
```

Alternatively, set an API key in `.env`:

```bash
cp .env.example .env
# Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY
```

---

## Web Dashboard

The `serve` command launches a web dashboard at `http://localhost:8080` with **two main action cards**:

1. **Full Project Intelligence** — Enter an Octant address, click one button, watch 9 steps stream in real-time. Results include summary cards, multi-layer scores, blockchain activity (9 chains + stablecoin holdings), mechanism impact, temporal anomalies, funding history, trust flags, and a downloadable PDF report.

2. **AI Project Evaluation** — Enter a project name, description, and optional GitHub URL. One click produces an 8-dimension AI evaluation with PDF report.

Additional features:

- AI model selector (4 providers, 12 models, switch on the fly)
- SSE real-time streaming with step-by-step progress
- Inline PDF report viewer
- Service status indicators (Octant, Blockchain RPC, AI)
- Reports section with all generated PDFs

![Tessera Dashboard](frontend/public/dashboard-screenshot.png)

---

## Key Findings from Real Data

Analysis of Octant Epoch 5 (30 projects, 1,902 donations, 422 unique donors):

| Finding                       | Value                                | Significance                                                         |
| ----------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Whale concentration           | 97.9%                                | Top 10% of donors control nearly all funding                         |
| Donor coordination clusters   | 41 pairs (Jaccard > 0.7)             | Overlapping donor sets suggest coordinated behavior                  |
| Single-whale dominance        | 0x2585 controls 90-99% of 5 projects | One address dictates outcomes for multiple projects                  |
| Coordination shift detected   | 39-donor cluster                     | Temporal anomaly: large group appeared in a single epoch             |
| Equal Weight mechanism impact | +3105% for smallest project          | Alternative mechanism would radically redistribute funding           |
| Median Shannon entropy        | 0.33                                 | Donor bases are structurally concentrated, not diverse               |
| #1 project multi-layer score  | 36.6/100 (vs 89.5 composite)         | Multi-layer scoring reveals whale dependency that simple scores hide |
| 931% funding spike            | E4 to E5, fewer donors               | Textbook whale-driven behavior flagged by temporal anomaly detection |

---

## Evidence Pipeline (analyze-project)

The `analyze-project` command runs a **9-step pipeline** that feeds all collected evidence into the AI evaluation:

| Step | Name                            | Data                                                                     | AI Required |
| ---- | ------------------------------- | ------------------------------------------------------------------------ | ----------- |
| 1    | Funding History                 | Cross-epoch allocations, matched funding, donor counts                   | No          |
| 2    | Quantitative Scoring            | K-means clustering, composite score, epoch rank                          | No          |
| 3    | Trust Graph                     | Shannon entropy, whale dependency, Jaccard similarity, coordination risk | No          |
| 4    | Mechanism Simulation            | Standard QF, Capped QF, Equal Weight, Trust-Weighted QF                  | No          |
| 5    | Temporal Anomalies              | Donor surge/exodus, funding spikes, new whale entry, coordination shifts | No          |
| 6    | Multi-Layer Scoring             | Funding, Efficiency, Diversity, Consistency, Overall (5 dimensions)      | No          |
| 7    | **Multi-Chain Blockchain Scan** | Balance, txs, contract detection, USDC/USDT/DAI across 9 EVM chains      | No          |
| 8    | Code Signals                    | OSO metrics or GitHub API fallback (stars, forks, commits, contributors) | No          |
| 9    | AI Deep Evaluation              | Evidence-grounded assessment using ALL data from steps 1-8               | Yes         |

Steps 1-8 are deterministic and reproducible. Step 9 uses AI to synthesize all evidence into a narrative with trajectory analysis, organic vs gaming assessment, counterfactual impact, and confidence-rated recommendation.

---

## Multi-Chain Blockchain Scan

Tessera scans addresses across **9 EVM chains** concurrently via direct JSON-RPC calls (no API keys needed):

| Chain      | Network | Native Token | Stablecoins Tracked |
| ---------- | ------- | ------------ | ------------------- |
| Ethereum   | Mainnet | ETH          | USDC, USDT, DAI     |
| Base       | Mainnet | ETH          | USDC, DAI           |
| Optimism   | Mainnet | ETH          | USDC, USDT, DAI     |
| Arbitrum   | Mainnet | ETH          | USDC, USDT, DAI     |
| Mantle     | Mainnet | MNT          | USDC, USDT          |
| Scroll     | Mainnet | ETH          | USDC, USDT          |
| Linea      | Mainnet | ETH          | USDC, USDT          |
| zkSync Era | Mainnet | ETH          | USDC, USDT          |
| Monad      | Testnet | MON          | —                   |

Per-chain data collected:

- Native token balance (wei hex → ETH)
- Transaction count (nonce — activity indicator)
- Contract detection (`eth_getCode`)
- ERC-20 token balances (`balanceOf` via `eth_call`) for USDC, USDT, DAI
- Recent transactions and token transfers (Etherscan-compatible explorer APIs)
- Contract verification status

Typical scan completes in **~2-3 seconds** across all 9 chains.

---

## All 20 Commands

### Quantitative Analysis (no AI needed)

| Command                 | Description                                                               | Data Source     |
| ----------------------- | ------------------------------------------------------------------------- | --------------- |
| `status`                | Check connection to all data sources, blockchain RPC, and AI providers    | All             |
| `providers`             | Display configured AI providers and fallback order                        | Local config    |
| `list-projects -e N`    | List all projects in Octant epoch N                                       | Octant REST     |
| `analyze-epoch -e N`    | K-means clustering + composite scoring for epoch N                        | Octant REST     |
| `detect-anomalies -e N` | Whale concentration + coordinated donation patterns                       | Octant REST     |
| `trust-graph -e N`      | Donor diversity, whale dependency, Jaccard similarity matrix              | Octant REST     |
| `simulate -e N`         | Compare Standard QF, Capped QF, Equal Weight, Trust-Weighted QF           | Octant REST     |
| `track-project <addr>`  | Cross-epoch timeline + temporal anomaly detection + multi-layer scoring   | Octant REST     |
| `scan-chain <addr>`     | Scan address across 9 EVM chains (balance, txs, contracts, USDC/USDT/DAI) | Blockchain RPC  |
| `gitcoin-rounds -r ID`  | Analyze Gitcoin Grants round data                                         | Gitcoin GraphQL |

### Qualitative Analysis (AI powered)

| Command                              | Description                                                          | Data Source         |
| ------------------------------------ | -------------------------------------------------------------------- | ------------------- |
| `evaluate "Name" -d "Desc" [-g url]` | 8-dimension evaluation with GitHub enrichment + PDF report           | User input + GitHub |
| `analyze-project <addr>`             | **Full 9-step intelligence pipeline** + PDF report                   | All sources         |
| `deep-eval <addr> [-n oso-name]`     | Multi-epoch deep evaluation with trajectory analysis                 | Octant + OSO + AI   |
| `scan-proposal <name> -d "text"`     | Two-pass proposal verification (SUPPORTED/CONTRADICTED/UNVERIFIABLE) | User input + AI     |
| `extract-metrics "text"`             | Extract structured impact metrics from text                          | User input + AI     |
| `report-epoch -e N`                  | Generate comprehensive epoch report                                  | Octant + AI         |
| `collect-signals <name-or-repo>`     | Collect OSO + GitHub + blockchain signals                            | OSO + GitHub + RPC  |

### Social & Server

| Command                             | Description                                   |
| ----------------------------------- | --------------------------------------------- |
| `moltbook status/post/reply/follow` | Moltbook social network interaction           |
| `heartbeat [--loop]`                | Autonomous notification check + AI auto-reply |
| `serve`                             | Start web dashboard at http://localhost:8080  |

---

## Multi-Layer Scoring System

| Dimension        | Weight | What It Measures                                                  |
| ---------------- | ------ | ----------------------------------------------------------------- |
| FundingScore     | 25%    | Total funding normalized across the epoch                         |
| EfficiencyScore  | 25%    | Ratio of matched funding to direct allocations (QF amplification) |
| DiversityScore   | 30%    | Shannon entropy of donor distribution (higher = more diverse)     |
| ConsistencyScore | 20%    | Cross-epoch funding stability (coefficient of variation)          |
| **OverallScore** | —      | Weighted aggregate of all dimensions                              |

**Why this matters:** The #1 ranked project by simple composite score (89.5/100) drops to 36.6/100 under multi-layer scoring — because its Diversity is 10.9 (whale-dominated) and Efficiency is 5.9 (low QF amplification).

---

## Trust-Weighted Quadratic Funding

Tessera implements a novel mechanism: QF modulated by donor diversity scores. Standard QF is vulnerable to whale dominance; Trust-Weighted QF adjusts each donor's influence by their diversity score (Shannon entropy of donation portfolio). The `simulate` command compares four mechanisms side-by-side:

- **Standard QF** — baseline quadratic funding
- **Capped QF** — individual contribution caps (10%)
- **Equal Weight** — one-person-one-vote
- **Trust-Weighted QF** — QF modulated by donor diversity (multiplier: 0.5 + 0.5 × diversity_score)

---

## Architecture

| Module         | File                                | Responsibility                                                    |
| -------------- | ----------------------------------- | ----------------------------------------------------------------- |
| CLI            | `cmd/analyst/main.go`               | 20 commands, flag parsing, .env loading                           |
| Provider       | `internal/provider/provider.go`     | Multi-model AI fallback chain (4 providers, 12 models)            |
| Octant         | `internal/data/octant.go`           | REST client for epochs, projects, allocations, rewards            |
| Gitcoin        | `internal/data/gitcoin.go`          | GraphQL client for rounds, applications, donations                |
| OSO            | `internal/data/oso.go`              | GraphQL client for project registry and metrics                   |
| GitHub         | `internal/data/github.go`           | GitHub API client for repo metrics, README                        |
| **Blockchain** | `internal/data/blockchain.go`       | **Multi-chain EVM scanner (9 chains, ERC-20 tokens, JSON-RPC)**   |
| Quantitative   | `internal/analysis/quantitative.go` | K-means clustering, composite scoring, anomaly detection          |
| Trust Graph    | `internal/analysis/graph.go`        | Shannon entropy, Jaccard similarity, whale dependency, union-find |
| Mechanism      | `internal/analysis/mechanism.go`    | 4 QF simulations including Trust-Weighted (novel)                 |
| Qualitative    | `internal/analysis/qualitative.go`  | LLM evaluation, proposal scanning, metric extraction              |
| Report         | `internal/report/pdf.go`            | Branded PDF reports with embedded logo, watermark                 |
| Server         | `internal/server/server.go`         | HTTP API (19 endpoints) + SSE streaming                           |
| Frontend       | `frontend/`                         | Next.js 19 dashboard (2 main action cards + reports)              |

---

## Multi-Model AI Provider Chain

| Provider                 | Models                                                                                                            | Auth                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Claude CLI** (primary) | `claude-opus-4-6`, `claude-sonnet-4-6`                                                                            | Claude Code login (no API key) |
| **Claude API**           | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5`                                                        | `ANTHROPIC_API_KEY`            |
| **Gemini**               | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-2.5-flash-lite` | `GEMINI_API_KEY`               |
| **OpenAI**               | `gpt-4o`, `gpt-4o-mini`, `o3-mini`                                                                                | `OPENAI_API_KEY`               |

Fallback logic: preferred model first → default model per remaining provider. 120s timeout per request.

---

## Data Sources

| Source               | Protocol | Data Available                                                     |
| -------------------- | -------- | ------------------------------------------------------------------ |
| Octant               | REST     | Projects, allocations, rewards, epochs, patrons, budgets, leverage |
| Gitcoin Grants Stack | GraphQL  | Rounds, applications, donations, matching amounts                  |
| Open Source Observer | GraphQL  | Project registry, GitHub metrics, on-chain activity                |
| **Blockchain RPC**   | JSON-RPC | Balance, txs, contracts, ERC-20 tokens (9 EVM chains)              |
| **Block Explorers**  | REST     | Recent transactions, token transfers, contract verification        |
| GitHub               | REST     | Repo metrics, contributors, README content                         |
| Moltbook             | REST     | Social posts, heartbeats, community engagement                     |

---

## PDF Reports

Both `analyze-project` and `evaluate` generate branded PDF intelligence reports with the Tessera logo in header, title, and footer.

**analyze-project** PDF contains: funding history, trust profile, multi-layer scores, mechanism simulation, temporal anomalies, **multi-chain blockchain activity** (9 chains + stablecoin holdings), and AI deep evaluation.

**evaluate** PDF contains: project description, GitHub repository data (if `-g` provided), and AI evaluation across 8 dimensions.

Reports are saved to `reports/` and served through the web dashboard.

---

## Bounty Alignment

| Bounty               | Prize  | Tessera Features                                                                                                                                                     |
| -------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Open Track**       | $28,308 | Full 9-step pipeline, 20 CLI commands, web dashboard, branded PDF reports, Trust-Weighted QF, multi-chain blockchain scanner                                         |
| **Data Analysis**    | $1,000 | analyze-epoch, trust-graph, deep-eval, report-epoch, analyze-project: 41 donor clusters, 97.9% whale concentration, multi-layer scoring                              |
| **Data Collection**  | $1,000 | 7 data sources (Octant, Gitcoin, OSO, GitHub, 9 blockchain RPCs, block explorers, Moltbook), ERC-20 token balances (USDC/USDT/DAI), scan-proposal claim verification |
| **Mechanism Design** | $1,000 | simulate (4 QF variants), Trust-Weighted QF (novel), Gini coefficients, per-project redistribution analysis                                                          |

See [FINDINGS.md](FINDINGS.md) for detailed insights from real Octant data.

---

## Built For

**The Synthesis** — a 14-day hackathon where AI agents and humans build together as equals.

|                   |                                                                               |
| ----------------- | ----------------------------------------------------------------------------- |
| Tracks            | Data Analysis ($1,000) + Data Collection ($1,000) + Mechanism Design ($1,000) + Open Track ($28,308) |
| Human             | Yeheskiel Yunus Tame ([@YeheskielTame](https://x.com/YeheskielTame))          |
| Agent             | Claude Opus 4.6 via Claude Code                                               |
| Repo              | [github.com/yeheskieltame/Tessera](https://github.com/yeheskieltame/Tessera)  |
| Collaboration Log | [CONVERSATION_LOG.md](CONVERSATION_LOG.md)                                    |

---

## License

MIT
