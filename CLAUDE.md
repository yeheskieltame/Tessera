# CLAUDE.md — Tessera (The Synthesis Hackathon)

## Project Overview

**Tessera** adalah AI agent CLI tool untuk evaluasi proyek public goods di ekosistem Ethereum. Dibangun untuk **The Synthesis Hackathon** — hackathon 14 hari dimana AI agent dan manusia membangun bersama.

- **Agent Name:** Synthesis Agent
- **Hackathon:** The Synthesis (synthesis.devfolio.co)
- **Track:** Agents for Public Goods Data Analysis for Project Evaluation (Octant partner, $1000)
- **Model:** Claude Opus 4.6 via Claude Code
- **Human:** Yeheskiel Yunus Tame (@YeheskielTame)

---

## Hackathon Registration & IDs

- **Participant ID:** `11c3550860c8400885327b29b074da81`
- **Team ID:** `39611a09e000455abce8a81b57a58540`
- **On-chain TX:** https://basescan.org/tx/0x2ef2402a1528f7841e880fd90b2246fbee688e0ab2e922f4163c7b291891451b
- **API Key:** Stored in `.env` as `SYNTHESIS_API_KEY`
- **Base URL:** `https://synthesis.devfolio.co`

---

## Hackathon API Reference (Registration → Submission)

### Step 1: Registration (DONE)

```bash
POST https://synthesis.devfolio.co/register
Content-Type: application/json

{
  "name": "Synthesis Agent",
  "description": "AI agent for public goods data analysis...",
  "agentHarness": "claude-code",
  "model": "claude-opus-4-6",
  "humanInfo": { ... }
}
```

Response memberikan `participantId`, `teamId`, `apiKey`, `registrationTxn`.

### Step 2: Self-Custody Transfer (REQUIRED sebelum publish)

```bash
# Initiate
POST /participants/me/transfer/init
Authorization: Bearer sk-synth-...
{ "targetOwnerAddress": "0xWALLET_ADDRESS" }

# Confirm (dalam 15 menit)
POST /participants/me/transfer/confirm
Authorization: Bearer sk-synth-...
{ "transferToken": "tok_...", "targetOwnerAddress": "0xWALLET_ADDRESS" }
```

Butuh wallet address (Base Mainnet). Lihat: https://synthesis.devfolio.co/wallet-setup/skill.md

### Step 3: Create Project (Draft)

```bash
POST /projects
Authorization: Bearer sk-synth-...
Content-Type: application/json

{
  "teamUUID": "39611a09e000455abce8a81b57a58540",
  "name": "Tessera",
  "description": "...",
  "problemStatement": "...",
  "repoURL": "https://github.com/yeheskieltame/Tessera",
  "trackUUIDs": ["<track-uuid>"],
  "conversationLog": "...",
  "submissionMetadata": {
    "agentFramework": "other",
    "agentFrameworkOther": "Custom Go CLI with multi-model AI fallback",
    "agentHarness": "claude-code",
    "model": "claude-opus-4-6",
    "skills": ["public-goods-analyst"],
    "tools": ["go", "net/http", "encoding/json", "math/big"],
    "helpfulResources": [
      "https://synthesis.devfolio.co/skill.md",
      "https://docs.oso.xyz/blog/octant-2024-grant-analytics/",
      "https://docs.octant.app/en-EN/how-it-works.html"
    ],
    "intention": "continuing"
  }
}
```

### Step 4: Update Project (Optional)

```bash
POST /projects/:projectUUID
Authorization: Bearer sk-synth-...
{ "description": "Updated...", "trackUUIDs": ["..."] }
```

### Step 5: Post on Moltbook

Baca skill: https://www.moltbook.com/skill.md
Post berisi: apa yang dibangun, track, link repo.
Simpan URL post ke `submissionMetadata.moltbookPostURL`.

### Step 6: Publish

```bash
POST /projects/:projectUUID/publish
Authorization: Bearer sk-synth-...
```

Requirements sebelum publish:

- Self-custody transfer selesai
- Nama project ada
- Minimal 1 track assigned
- repoURL public

### Track UUIDs (Octant)

Fetch dari catalog:

```bash
GET /catalog?search=octant&per_page=100&page=2
```

| Track                                                          | Slug                                    | Prize  |
| -------------------------------------------------------------- | --------------------------------------- | ------ |
| Agents for Public Goods Data Analysis for Project Evaluation   | `data-analysis-track-j5lvk8`            | $1,000 |
| Agents for Public Goods Data Collection for Project Evaluation | `data-collection-track-w3wbn7`          | $1,000 |
| Mechanism Design for Public Goods Evaluation                   | `subjectivity-and-context-track-8vtj5l` | $1,000 |

### Team Management

```bash
GET /teams/:teamUUID              # View team
POST /teams/:teamUUID/invite      # Get invite code
POST /teams/:teamUUID/join        # Join team { "inviteCode": "..." }
POST /teams/:teamUUID/leave       # Leave team
```

---

## Apa yang Dibangun

### Tech Stack

**Go** — dipilih karena:

- Single binary ~9MB, zero runtime dependencies
- Startup <5ms (vs Python ~300ms)
- Native concurrency (goroutines) untuk multi-agent future
- Mudah didistribusi sebagai skill ke OpenClaw, Claude Code, Gemini CLI

### Arsitektur

```
synthesis/
├── .env                          # API keys (gitignored)
├── go.mod / go.sum               # Go module
├── CLAUDE.md                     # File ini
├── tessera                       # Compiled binary (~9MB)
├── cmd/
│   └── analyst/
│       └── main.go               # CLI entry point (20 commands)
├── internal/
│   ├── provider/
│   │   └── provider.go           # Multi-model AI fallback chain (4 providers, 12 models)
│   ├── data/
│   │   ├── octant.go             # Octant REST API client
│   │   ├── gitcoin.go            # Gitcoin GraphQL client
│   │   ├── oso.go                # Open Source Observer client
│   │   ├── github.go             # GitHub API client (fallback)
│   │   └── blockchain.go         # Multi-chain EVM scanner (9 chains, ERC-20 tokens)
│   ├── analysis/
│   │   ├── quantitative.go       # K-means clustering, composite scoring, anomaly detection
│   │   ├── graph.go              # Trust graph: Shannon entropy, Jaccard, whale dependency
│   │   ├── mechanism.go          # 4 QF simulations: Standard, Capped, Equal, Trust-Weighted
│   │   └── qualitative.go        # LLM evaluation, comparison, proposal scanning
│   ├── report/
│   │   ├── report.go             # Markdown report generation
│   │   ├── pdf.go                # Branded PDF with embedded logo
│   │   └── assets/               # Embedded logo PNGs (go:embed)
│   ├── server/
│   │   └── server.go             # HTTP API (19 endpoints, SSE streaming)
│   └── social/
│       └── moltbook.go           # Moltbook API client
├── frontend/                     # Next.js 19 dashboard (2 main action cards)
└── skills/
    └── public-goods-analyst/
        └── SKILL.md              # OpenClaw skill definition
```

### Multi-Model Fallback Chain

Provider dicoba berurutan. Jika gagal, otomatis pindah ke berikutnya:

1. **Claude CLI** (auto-detected) — primary, uses `claude --print`, untuk pelanggan Claude Code / Max plan (5x subscription), tanpa API key
2. **Claude API** (`ANTHROPIC_API_KEY`) — direct API fallback
3. **Google Gemini** (`GEMINI_API_KEY`) — fallback
4. **OpenAI** (`OPENAI_API_KEY`) — fallback

> **Untuk pengguna Claude Max plan:** Cukup install Claude Code (`npm i -g @anthropic-ai/claude-code`), login, dan Tessera akan otomatis menggunakan Claude CLI sebagai AI provider. Tidak perlu API key.

### Build & Run

```bash
# Build
go build -o tessera ./cmd/analyst/

# Or run directly
go run ./cmd/analyst/ <command>
```

### CLI Commands (20 total)

**2 operasi utama (dashboard buttons):**

```bash
./tessera analyze-project <addr>  # 9-step full intelligence pipeline + PDF
./tessera evaluate "Name" -d "desc" [-g github-url]  # 8-dimension AI eval + PDF
```

**Analisis kuantitatif (tanpa AI):**

```bash
./tessera status              # Cek koneksi (Octant, Gitcoin, OSO, 9 blockchain RPCs, AI)
./tessera providers           # Lihat AI provider chain
./tessera list-projects -e 5  # List project Octant per epoch
./tessera analyze-epoch -e 5  # K-means clustering + composite scoring
./tessera detect-anomalies -e 5      # Whale concentration + coordinated patterns
./tessera trust-graph -e 5           # Donor diversity, Jaccard similarity
./tessera simulate -e 5             # Compare 4 QF mechanisms
./tessera track-project <addr>      # Cross-epoch + temporal anomalies
./tessera scan-chain <addr>         # Scan 9 EVM chains (balance, txs, USDC/USDT/DAI)
./tessera gitcoin-rounds -r ID      # Analisis round Gitcoin
```

### Data Sources

| Source                   | Type     | Data                                                               |
| ------------------------ | -------- | ------------------------------------------------------------------ |
| **Octant API**           | REST     | Projects, allocations, rewards, epochs, patrons, budgets, leverage |
| **Gitcoin Grants Stack** | GraphQL  | Rounds, applications, donations, matching                          |
| **Open Source Observer** | GraphQL  | GitHub metrics, on-chain activity, ecosystem data                  |
| **Blockchain RPC**       | JSON-RPC | Balance, txs, contracts, ERC-20 tokens (9 EVM chains)              |
| **Block Explorers**      | REST     | Recent txs, token transfers, contract verification                 |
| **GitHub API**           | REST     | Repo metrics, contributors, README                                 |

### Fitur Analisis

**Kuantitatif:**

- K-means clustering (mengelompokkan project berdasar profil serupa)
- Composite scoring (skor gabungan 0-100, normalized, 40% allocated + 60% matched)
- Anomaly detection (whale concentration, coordinated donation patterns dengan smart threshold)
- Wei-to-ETH conversion untuk semua funding data

**Kualitatif (via AI):**

- Evaluasi project proposal (8 dimensi: Impact, Team, Innovation, Sustainability, Ecosystem, Transparency, Community, Risk)
- Perbandingan multi-project
- Analisis sentimen komunitas
- Ekstraksi metrik impact dari teks

### OpenClaw Skill

Skill `public-goods-analyst` tersedia di `skills/public-goods-analyst/SKILL.md`:

- User-invocable sebagai slash command
- Gating: butuh `tessera` binary (Go compiled)
- Auto-build via `go build -o tessera ./cmd/analyst/`
- Bisa dipublish ke ClawHub: `npx clawhub@latest`
- Compatible dengan OpenClaw, Claude Code, dan Gemini CLI

---

## Environment Variables

```bash
# Hackathon (required)
SYNTHESIS_API_KEY=sk-synth-...
SYNTHESIS_PARTICIPANT_ID=...
SYNTHESIS_TEAM_ID=...

# AI Providers (minimal 1)
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
OPENAI_API_KEY=sk-...

# Claude CLI (auto-detected if `claude` binary exists, no key needed)
# CLAUDE_CLI_DISABLED=true

# Data source (optional)
OSO_API_KEY=...

# Note: Model selection is done via the Dashboard UI dropdown.
# No model override env vars needed.
```

---

## Submission Checklist

- [x] Registrasi hackathon (ERC-8004 on-chain identity)
- [x] Setup GitHub repo (public) — https://github.com/yeheskieltame/Tessera
- [x] Self-custody transfer — NFT #32417 → `0x77c4a1cD22005b67Eb9CcEaE7E9577188d7Bca82`
- [x] Create project draft via API — UUID: `87473a05b9c64d74b284c5bcf01fed64`, slug: `tessera-bf0d`
- [x] Conversation log submitted via API (14→19 phases)
- [x] Unit tests (13 tests, all passing)
- [x] Sample output (examples/sample-output.md)
- [x] Moltbook agent registered (`tessera-agent`) — karma: 6, followers: 2, following: 6, posts: 1, comments: 5
- [x] Moltbook human claim — claimed by human, `is_claimed: true`
- [x] Moltbook post — "Tessera: AI-Powered Public Goods Evaluation for Octant" (https://www.moltbook.com/s/general/tessera-ai-powered-public-goods-evaluation-for-octant)
- [x] Publish project — status: `publish`, verified 2026-03-19
- [x] Verifikasi di `GET /projects` listing — found on page 7, slug: `tessera-bf0d`
- [x] 3 tracks assigned: Data Analysis, Data Collection, Mechanism Design

---

## Octant Context

**Octant** adalah platform public goods funding oleh Golem Foundation:

- Stake 100,000 ETH sebagai validator
- Setiap 90 hari (epoch), staking reward dibagi ke project via quadratic funding
- User lock GLM token, lalu alokasi reward ke project pilihan
- Total ~$5M sudah didistribusi ke 60+ project

**Problem yang dipecahkan:**
Evaluator public goods menghadapi cognitive overload — tidak bisa scale analisis ke puluhan project dengan metrik beragam. Data kualitatif (proposal, diskusi forum) sangat sulit dinilai manual. Agent ini mengotomasi analisis kuantitatif dan kualitatif untuk membantu evaluator.

**Pain points utama:**

- Cognitive overload (terlalu banyak project, terlalu sedikit waktu)
- Sybil attacks pada quadratic funding
- Sulit mengukur impact secara counterfactual
- Whale concentration mendistorsi funding
- Data kualitatif tidak bisa di-scale manual

---

## Useful Links

- **Hackathon:** https://synthesis.devfolio.co
- **Skill API:** https://synthesis.devfolio.co/skill.md
- **Submission Skill:** https://synthesis.devfolio.co/submission/skill.md
- **Themes:** https://synthesis.devfolio.co/themes.md
- **Prize Catalog:** https://synthesis.devfolio.co/catalog/prizes.md
- **Wallet Setup:** https://synthesis.devfolio.co/wallet-setup/skill.md
- **Moltbook Skill:** https://www.moltbook.com/skill.md
- **Telegram Updates:** https://nsb.dev/synthesis-updates
- **Octant Docs:** https://docs.octant.app/en-EN/how-it-works.html
- **Octant GitHub:** https://github.com/golemfoundation/octant
- **OSO Octant Analytics:** https://docs.oso.xyz/blog/octant-2024-grant-analytics/
- **ERC-8004:** https://eips.ethereum.org/EIPS/eip-8004
- **OpenClaw Docs:** https://docs.openclaw.ai/skills
- **ClawHub:** https://clawhub.ai
- **EthSkills:** https://ethskills.com/SKILL.md

---

## Rules Hackathon

1. Ship something yang works (demo, prototype, deployed contract)
2. Agent harus real participant, bukan wrapper
3. Semua on-chain counts (contracts, ERC-8004, attestations)
4. Open source required (repo public sebelum deadline)
5. Dokumentasikan proses (conversationLog = kolaborasi human-agent)
