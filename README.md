# Tessera

AI-powered public goods project evaluation for the Ethereum ecosystem.

*Named after the Latin word for "mosaic piece" -- assembling fragments of on-chain data, funding records, and community signals into a complete picture of project health.*

---

## What It Does

Tessera is a CLI tool (18 commands) and web dashboard that evaluates projects funded through Octant, Gitcoin, and other Ethereum public goods platforms. Its core command (`analyze-project`) runs an 8-step evidence pipeline: cross-epoch funding history, quantitative scoring, trust-graph analysis (Jaccard similarity, Shannon entropy), mechanism simulation (4 QF variants including novel Trust-Weighted QF), temporal anomaly detection, multi-layer scoring (5 dimensions), OSO data collection, and AI deep evaluation via Claude Opus 4.6. The AI evaluation is evidence-grounded -- it receives all quantitative and trust data before generating its assessment, not just project descriptions. Output includes branded PDF reports with Tessera Agent watermark.

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

## Key Findings from Real Data

Analysis of Octant Epoch 5 (30 projects, 1,902 donations, 422 unique donors):

| Finding | Value | Significance |
|---------|-------|-------------|
| Whale concentration | 97.9% | Top 10% of donors control nearly all funding |
| Donor coordination clusters | 41 pairs (Jaccard > 0.7) | Overlapping donor sets suggest coordinated behavior |
| Single-whale dominance | 0x2585 controls 90-99% of 5 projects | One address dictates outcomes for multiple projects |
| Coordination shift detected | 39-donor cluster | Temporal anomaly: large group appeared in a single epoch |
| Equal Weight mechanism impact | +3105% for smallest project | Alternative mechanism would radically redistribute funding |
| Median Shannon entropy | 0.33 | Donor bases are structurally concentrated, not diverse |
| #1 project multi-layer score | 36.6/100 (vs 89.5 composite) | Multi-layer scoring reveals whale dependency that simple scores hide |
| 931% funding spike | E4 to E5, fewer donors | Textbook whale-driven behavior flagged by temporal anomaly detection |

---

## All 18 Commands

### Quantitative Analysis (no AI needed)

| Command | Description | Data Source |
|---------|-------------|-------------|
| `status` | Check connection to all data sources and AI providers | Octant, Gitcoin, OSO |
| `providers` | Display configured AI providers and fallback order | Local config |
| `list-projects -e N` | List all projects in Octant epoch N | Octant REST |
| `analyze-epoch -e N` | K-means clustering + composite scoring for epoch N | Octant REST |
| `detect-anomalies -e N` | Whale concentration + coordinated donation patterns | Octant REST |
| `trust-graph -e N` | Donor diversity, whale dependency, Jaccard similarity matrix | Octant REST |
| `simulate -e N` | Compare Standard QF, Capped QF, Equal Weight, Trust-Weighted QF | Octant REST |
| `track-project <addr>` | Cross-epoch timeline + temporal anomaly detection + multi-layer scoring | Octant REST |

### Qualitative Analysis (AI powered)

| Command | Description | Data Source | AI Required |
|---------|-------------|-------------|-------------|
| `evaluate "Name" -d "Desc"` | 8-dimension LLM evaluation with scored rubric | User input | Yes |
| `deep-eval <addr> -e N` | Deep evaluation combining on-chain data with AI analysis | Octant + AI | Yes |
| `scan-proposal <url>` | Scan and evaluate a project proposal from URL | Web + AI | Yes |
| `extract-metrics "text"` | Extract structured impact metrics from unstructured text | User input | Yes |
| `analyze-project <addr>` | Full intelligence report: quant + trust + simulation + AI eval + PDF | Octant + AI | Yes |
| `report-epoch -e N` | Generate comprehensive epoch report with all analyses | Octant + AI | Yes |
| `collect-signals <addr>` | Gather community signals and sentiment for a project | Multiple | Yes |

### Social (Moltbook)

| Command | Description | Data Source |
|---------|-------------|-------------|
| `moltbook` | Post project update to Moltbook social feed | Moltbook REST |
| `heartbeat` | Send periodic status heartbeat to Moltbook | Moltbook REST |

### Server

| Command | Description |
|---------|-------------|
| `serve` | Start web dashboard at http://localhost:8080 |

---

## Evidence Pipeline (analyze-project)

The `analyze-project` command runs an 8-step pipeline that feeds all collected evidence into the AI evaluation:

| Step | Name | Data | AI Required |
|------|------|------|-------------|
| 1 | Funding History | Cross-epoch allocations, matched funding, donor counts | No |
| 2 | Quantitative Scoring | K-means clustering, composite score, epoch rank | No |
| 3 | Trust Graph | Shannon entropy, whale dependency, Jaccard similarity, coordination risk | No |
| 4 | Mechanism Simulation | Standard QF, Capped QF, Equal Weight, Trust-Weighted QF | No |
| 5 | Temporal Anomalies | Donor surge/exodus, funding spikes, new whale entry, coordination shifts | No |
| 6 | Multi-Layer Scoring | Funding, Efficiency, Diversity, Consistency, Overall | No |
| 7 | OSO Signals | GitHub activity, on-chain metrics, cross-platform funding (optional) | No |
| 8 | AI Deep Evaluation | Evidence-grounded assessment using ALL data from steps 1-7 | Yes |

Steps 1-7 are deterministic and reproducible. Step 8 uses the AI to synthesize all evidence into a narrative with trajectory analysis, organic vs gaming assessment, counterfactual impact, and confidence-rated recommendation.

---

## Multi-Layer Scoring System

Tessera computes a 5-dimension score for each project, designed to capture funding health beyond raw totals:

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| FundingScore | 25% | Total funding normalized across the epoch |
| EfficiencyScore | 25% | Ratio of matched funding to direct allocations (QF amplification) |
| DiversityScore | 30% | Shannon entropy of donor distribution (higher = more diverse) |
| ConsistencyScore | 20% | Cross-epoch funding stability (coefficient of variation) |
| **OverallScore** | -- | Weighted aggregate of all dimensions |

**Why this matters:** The #1 ranked project by simple composite score (89.5/100) drops to an Overall Score of 36.6/100 when multi-layer scoring is applied -- because its Diversity is 10.9 (whale-dominated) and Efficiency is 5.9 (low QF amplification). Multi-layer scoring catches what simple funding totals miss.

Projects with high OverallScore but low DiversityScore are flagged as whale-dependent. Projects with high DiversityScore but low FundingScore may be undervalued by the current mechanism.

---

## Temporal Anomaly Detection

The `track-project` command monitors a project across epochs and flags 5 temporal patterns:

| Pattern | Detection Method | Severity |
|---------|-----------------|----------|
| Donor Surge | Donor count increases >50% epoch-over-epoch | Medium |
| Donor Exodus | Donor count drops >50% epoch-over-epoch | High |
| Funding Spike | Funding increases >3x from previous epoch | Medium |
| New Whale Entry | New top-10% donor appears with >30% of total | High |
| Coordination Shift | Jaccard similarity of donor sets changes >0.5 between epochs | High |

---

## Trust-Weighted Quadratic Funding

Tessera implements a novel mechanism design: QF modulated by donor diversity scores.

Standard quadratic funding is vulnerable to whale dominance and coordinated attacks. Trust-Weighted QF adjusts each donor's influence by their diversity score (derived from Shannon entropy of their donation portfolio). Donors who spread contributions across many projects receive higher weight; single-project donors receive lower weight.

The `simulate` command compares four mechanisms side-by-side:

- **Standard QF** -- baseline quadratic funding
- **Capped QF** -- individual contribution caps
- **Equal Weight** -- one-person-one-vote regardless of amount
- **Trust-Weighted QF** -- QF modulated by donor diversity scores

---

## Architecture

| Module | File | Responsibility |
|--------|------|----------------|
| CLI | `cmd/analyst/main.go` | Command routing, flag parsing, .env loading, terminal output |
| Provider | `internal/provider/provider.go` | Multi-model AI fallback chain (Claude, Gemini, OpenAI, Antigravity) |
| Octant | `internal/data/octant.go` | REST client for epochs, projects, allocations, rewards, patrons |
| Gitcoin | `internal/data/gitcoin.go` | GraphQL client for rounds, applications, donations |
| OSO | `internal/data/oso.go` | GraphQL client for project registry and timeseries metrics |
| Quantitative | `internal/analysis/quantitative.go` | K-means clustering, composite scoring, anomaly detection, trust graph |
| Qualitative | `internal/analysis/qualitative.go` | LLM evaluation, comparison, sentiment, metric extraction |
| Report | `internal/report/report.go` | Markdown and PDF report generation with branded watermark |
| Server | `internal/server/server.go` | HTTP server + SSE streaming for web dashboard |
| Frontend | `frontend/` | Next.js dashboard with real-time streaming |

---

## Data Sources

| Source | Protocol | Data Available |
|--------|----------|----------------|
| Octant | REST | Projects, allocations, rewards, epochs, patrons, budgets, leverage, threshold |
| Gitcoin Grants Stack | GraphQL | Rounds, applications, donations, matching amounts |
| Open Source Observer | GraphQL | Project registry, GitHub metrics, on-chain activity, timeseries |
| Moltbook | REST | Social posts, heartbeats, community engagement |

All quantitative data sources are public and require no authentication. OSO optionally accepts an API key for higher rate limits.

---

## PDF Reports

The `analyze-project` command generates branded PDF intelligence reports containing:

- Quantitative scoring and epoch rank
- Trust profile with donor diversity metrics
- Mechanism simulation showing impact of alternative funding models
- AI deep evaluation across 8 dimensions
- Temporal anomaly flags

Reports are saved to `reports/` and served through the web dashboard. Each PDF carries a "Tessera Agent" watermark.

---

## Bounty Alignment

| Bounty | Prize | Tessera Features | Key Findings |
|--------|-------|-----------------|--------------|
| **Data Analysis** | $1,000 | analyze-epoch, trust-graph, deep-eval, report-epoch, analyze-project | 41 donor clusters, 97.9% whale concentration, #1 project drops from 89.5 to 36.6 under multi-layer scoring |
| **Data Collection** | $1,000 | collect-signals (OSO), scan-proposal (two-pass verification), extract-metrics, cross-epoch history | Evidence-grounded AI evaluation using real API data, not just text descriptions |
| **Mechanism Design** | $1,000 | simulate (4 QF variants), Trust-Weighted QF (novel mechanism), Gini coefficients | Equal Weight +3105% for smallest project but maximizes sybil vulnerability; Trust-Weighted QF balances fairness and resistance |

See [FINDINGS.md](FINDINGS.md) for detailed insights generated from real Octant data.

---

## Built For

**The Synthesis** -- a 14-day hackathon where AI agents and humans build together as equals.

| | |
|-|-|
| Tracks | Data Analysis ($1,000) + Data Collection ($1,000) + Mechanism Design ($1,000) |
| Human | Yeheskiel Yunus Rame ([@YeheskielTame](https://x.com/YeheskielTame)) |
| Agent | Claude Opus 4.6 via Claude Code |
| Repo | [github.com/yeheskieltame/Tessera](https://github.com/yeheskieltame/Tessera) |
| Collaboration Log | [CONVERSATION_LOG.md](CONVERSATION_LOG.md) |

---

## License

MIT
