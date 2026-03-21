"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */

const NAV_LINKS = [
  { label: "Problem", id: "problem" },
  { label: "Pipeline", id: "pipeline" },
  { label: "Architecture", id: "architecture" },
  { label: "Algorithms", id: "algorithms" },
  { label: "Findings", id: "findings" },
  { label: "Setup", id: "setup" },
];

const STATS = [
  { value: "20", label: "CLI Commands" },
  { value: "9", label: "Pipeline Steps" },
  { value: "7", label: "Data Sources" },
  { value: "9", label: "EVM Chains" },
  { value: "4", label: "QF Mechanisms" },
  { value: "12", label: "AI Models" },
];

const PIPELINE_STEPS = [
  { num: 1, title: "Funding History", desc: "Cross-epoch allocations, matched funding, donor counts from Octant REST API", source: "Octant", ai: false, color: "from-blue-500 to-blue-600" },
  { num: 2, title: "Quantitative Scoring", desc: "K-means clustering (Lloyd's algorithm) + composite score (40% allocated + 60% matched)", source: "Analysis", ai: false, color: "from-teal-500 to-teal-600" },
  { num: 3, title: "Trust Graph", desc: "Shannon entropy, Jaccard similarity, whale dependency ratio, union-find donor clustering", source: "Analysis", ai: false, color: "from-sky-500 to-sky-600" },
  { num: 4, title: "Mechanism Simulation", desc: "Standard QF, Capped QF, Equal Weight, Trust-Weighted QF with Gini coefficients", source: "Analysis", ai: false, color: "from-amber-500 to-amber-600" },
  { num: 5, title: "Temporal Anomalies", desc: "Donor surge/exodus, funding spikes, new whale entries, coordination shifts", source: "Analysis", ai: false, color: "from-rose-500 to-rose-600" },
  { num: 6, title: "Multi-Layer Scoring", desc: "5 dimensions: Funding (25%), Efficiency (25%), Diversity (30%), Consistency (20%)", source: "Analysis", ai: false, color: "from-violet-500 to-violet-600" },
  { num: 7, title: "Blockchain Scan", desc: "9 EVM chains concurrent scan: balance, txs, contracts, USDC/USDT/DAI via eth_call", source: "RPC", ai: false, color: "from-emerald-500 to-emerald-600" },
  { num: 8, title: "Code Signals", desc: "OSO metrics or GitHub API fallback: stars, forks, commits, contributors", source: "OSO/GitHub", ai: false, color: "from-cyan-500 to-cyan-600" },
  { num: 9, title: "AI Deep Evaluation", desc: "Evidence-grounded narrative using ALL data from steps 1-8 via LLM", source: "AI Provider", ai: true, color: "from-indigo-500 to-indigo-600" },
];

const DATA_SOURCES = [
  { name: "Octant", protocol: "REST", data: "Projects, allocations, rewards, epochs, patrons, budgets", url: "backend.mainnet.octant.app" },
  { name: "Gitcoin", protocol: "GraphQL", data: "Rounds, applications, donations, matching amounts", url: "grants-stack-indexer-v2.gitcoin.co" },
  { name: "OSO", protocol: "GraphQL", data: "Project registry, GitHub metrics, on-chain activity", url: "opensource.observer" },
  { name: "GitHub", protocol: "REST", data: "Repo metrics, contributors, README content", url: "api.github.com" },
  { name: "Blockchain", protocol: "JSON-RPC", data: "Balance, txs, contracts, ERC-20 tokens (9 chains)", url: "Public RPCs" },
  { name: "Explorers", protocol: "REST", data: "Recent transactions, token transfers, contract verification", url: "Etherscan-compatible" },
  { name: "Moltbook", protocol: "REST", data: "Social posts, heartbeats, community engagement", url: "moltbook.com" },
];

const CHAINS = [
  { name: "Ethereum", token: "ETH", stables: "USDC, USDT, DAI" },
  { name: "Base", token: "ETH", stables: "USDC, DAI" },
  { name: "Optimism", token: "ETH", stables: "USDC, USDT, DAI" },
  { name: "Arbitrum", token: "ETH", stables: "USDC, USDT, DAI" },
  { name: "Mantle", token: "MNT", stables: "USDC, USDT" },
  { name: "Scroll", token: "ETH", stables: "USDC, USDT" },
  { name: "Linea", token: "ETH", stables: "USDC, USDT" },
  { name: "zkSync Era", token: "ETH", stables: "USDC, USDT" },
  { name: "Monad", token: "MON", stables: "Testnet" },
];

const FINDINGS = [
  { stat: "97.9%", label: "Whale Concentration", desc: "Top 10% of donors control nearly all funding. Structural, not episodic (92-98% across 4 epochs)." },
  { stat: "36.6", label: "Rank #1 True Score", desc: "Project ranked #1 by composite (89.5) drops to 36.6 under multi-layer scoring. 90% whale-dependent." },
  { stat: "41", label: "Donor Clusters", desc: "Jaccard > 0.7 overlap detected. Largest cluster: 39 donors moving in lockstep. Increasing over time." },
  { stat: "3,105%", label: "Mechanism Impact", desc: "Equal Weight QF would increase smallest project funding by 31x. Trust-Weighted QF balances fairness vs sybil resistance." },
  { stat: "5", label: "Whale-Controlled Projects", desc: "Single address 0x2585 controls 90-99% of 5 projects simultaneously. 17% of the ecosystem." },
  { stat: "931%", label: "Funding Spike", desc: "Epoch 4 to 5 surge with fewer donors. Textbook whale-driven behavior flagged by temporal anomaly detection." },
];

const ALGORITHMS = [
  {
    name: "Composite Score",
    formula: "(normAlloc x 0.4 + normMatch x 0.6) x 100",
    desc: "Matched funding weighted 60% to capture breadth of support via QF amplification.",
  },
  {
    name: "Shannon Entropy",
    formula: "H = -sum(p_i x log(p_i)) / log(n)",
    desc: "Normalized donor diversity. 0 = single donor, 1 = perfectly uniform distribution.",
  },
  {
    name: "Jaccard Similarity",
    formula: "|A intersection B| / |A union B|",
    desc: "Donor set overlap between projects. Flagged if > 0.7 (coordinated behavior).",
  },
  {
    name: "Trust-Weighted QF",
    formula: "score = QF x (0.5 + 0.5 x diversity)",
    desc: "Novel mechanism. Whale-dominated projects (diversity near 0) get 50% penalty. Organic support preserved.",
  },
  {
    name: "Gini Coefficient",
    formula: "sum((2r_i - n - 1) x a_i) / (n x sum(a_i))",
    desc: "Funding inequality measure. 0 = equal distribution, 1 = all to one project.",
  },
  {
    name: "Whale Dependency",
    formula: "max(donor_amount) / total_amount",
    desc: "Single-donor concentration. Flagged if > 0.5 (one donor provides majority).",
  },
];

const SETUP_STEPS = [
  { num: "01", title: "Clone & Build", code: "git clone https://github.com/yeheskieltame/Tessera.git\ncd Tessera\ngo build -o tessera ./cmd/analyst/" },
  { num: "02", title: "Configure AI Provider", code: "# Option A: Claude Max plan (auto-detected)\nnpm i -g @anthropic-ai/claude-code && claude login\n\n# Option B: API key in .env\necho 'GEMINI_API_KEY=your-key' > .env" },
  { num: "03", title: "Build Frontend", code: "cd frontend && npm install && npm run build && cd .." },
  { num: "04", title: "Launch", code: "./tessera serve\n# Open http://localhost:3001" },
];

const PROVIDERS = [
  { name: "Claude CLI", models: "opus-4-6, sonnet-4-6", auth: "Claude Code login (no key)" },
  { name: "Claude API", models: "opus-4-6, sonnet-4-6, haiku-4-5", auth: "ANTHROPIC_API_KEY" },
  { name: "Gemini", models: "2.5-pro, 2.5-flash, 3.1-pro, 3-flash, 2.5-flash-lite", auth: "GEMINI_API_KEY" },
  { name: "OpenAI", models: "gpt-4o, gpt-4o-mini, o3-mini", auth: "OPENAI_API_KEY" },
];

/* ═══════════════════════════════════════════════════════════
   ANIMATION HOOK: Intersection Observer
   ═══════════════════════════════════════════════════════════ */

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      {label && <div className="text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">{label}</div>}
      <pre className="bg-[#0d1117] text-[#c9d1d9] rounded-xl p-4 text-sm overflow-x-auto font-mono leading-relaxed border border-[#30363d]">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-3 right-3 px-2.5 py-1 text-xs font-medium rounded-md bg-[#21262d] text-[#8b949e] hover:text-white hover:bg-[#30363d] transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function SectionHeading({ title, subtitle, light = false }: { title: string; subtitle: string; light?: boolean }) {
  return (
    <Reveal>
      <div className="text-center mb-16">
        <h2 className={`text-3xl sm:text-4xl font-bold mb-4 ${light ? "text-slate-800" : "text-white"}`}>{title}</h2>
        <p className={`max-w-2xl mx-auto text-base leading-relaxed ${light ? "text-slate-500" : "text-white/50"}`}>{subtitle}</p>
      </div>
    </Reveal>
  );
}

/* ═══════════════════════════════════════════════════════════
   ACCORDION ITEM
   ═══════════════════════════════════════════════════════════ */

function AccordionItem({ title, tag, children, defaultOpen = false }: { title: string; tag?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border transition-all duration-300 ${open ? "bg-white/[0.03] border-white/10" : "bg-white/[0.01] border-white/5 hover:border-white/10"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <svg
          className={`w-4 h-4 text-white/30 flex-shrink-0 transition-transform duration-300 ${open ? "rotate-90" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm font-semibold text-white flex-1">{title}</span>
        {tag && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 font-mono flex-shrink-0">{tag}</span>}
      </button>
      <div
        className="overflow-hidden transition-all duration-400"
        style={{ maxHeight: open ? "2000px" : "0", opacity: open ? 1 : 0 }}
      >
        <div className="px-5 pb-5 pt-0">{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SETUP ACCORDION
   ═══════════════════════════════════════════════════════════ */

function SetupAccordion() {
  return (
    <div className="space-y-3">

      {/* Installation */}
      <Reveal delay={50}>
        <AccordionItem title="Installation" tag="Step 1" defaultOpen={true}>
          <p className="text-xs text-white/40 mb-4">Clone the repository and build the Go binary. Requires Go 1.25+ and Node.js 20+.</p>
          <CodeBlock code={`git clone https://github.com/yeheskieltame/Tessera.git
cd Tessera
go build -o tessera ./cmd/analyst/`} label="Terminal" />
          <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p className="text-[11px] text-white/30">The binary is ~9MB with zero runtime dependencies. Works on macOS, Linux, and Windows.</p>
          </div>
        </AccordionItem>
      </Reveal>

      {/* AI Provider Setup */}
      <Reveal delay={100}>
        <AccordionItem title="Configure AI Provider" tag="Step 2">
          <p className="text-xs text-white/40 mb-4">Choose one of the following. Claude CLI is auto-detected if installed.</p>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-white/25 uppercase tracking-wider mb-2">Option A: Claude Max Plan (recommended, no API key)</p>
              <CodeBlock code={`npm i -g @anthropic-ai/claude-code
claude login`} />
            </div>
            <div>
              <p className="text-[11px] text-white/25 uppercase tracking-wider mb-2">Option B: Gemini API Key</p>
              <CodeBlock code={`echo 'GEMINI_API_KEY=your-key-here' > .env`} />
            </div>
            <div>
              <p className="text-[11px] text-white/25 uppercase tracking-wider mb-2">Option C: Any other provider</p>
              <CodeBlock code={`# Set one or more in .env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...`} />
            </div>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p className="text-[11px] text-white/30">Fallback order: Claude CLI &rarr; Claude API &rarr; Gemini &rarr; OpenAI. If one fails, the next is tried automatically. Quantitative commands (analyze-epoch, trust-graph, simulate, scan-chain) work without any AI provider.</p>
          </div>
        </AccordionItem>
      </Reveal>

      {/* Build Frontend */}
      <Reveal delay={150}>
        <AccordionItem title="Build Frontend (optional)" tag="Step 3">
          <p className="text-xs text-white/40 mb-4">Only needed if you want the web dashboard. CLI works without it.</p>
          <CodeBlock code={`cd frontend && npm install && npm run build && cd ..`} label="Terminal" />
          <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p className="text-[11px] text-white/30">Next.js 19 static export. The Go server serves the dashboard from ./frontend/dist/ automatically.</p>
          </div>
        </AccordionItem>
      </Reveal>

      {/* Launch */}
      <Reveal delay={200}>
        <AccordionItem title="Launch Server + Dashboard" tag="Step 4">
          <p className="text-xs text-white/40 mb-4">Start the HTTP API and web dashboard with a single command.</p>
          <CodeBlock code={`./tessera serve
# Server starts on http://localhost:3001
# Dashboard: http://localhost:3001
# API: http://localhost:3001/api/status`} label="Terminal" />
        </AccordionItem>
      </Reveal>

      {/* Divider */}
      <Reveal delay={250}>
        <div className="flex items-center gap-3 py-4">
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-xs text-white/20 font-medium">CLI Commands Reference</span>
          <div className="h-px flex-1 bg-white/5" />
        </div>
      </Reveal>

      {/* Primary Commands */}
      <Reveal delay={300}>
        <AccordionItem title="Full Project Intelligence (9-step pipeline)" tag="Primary">
          <p className="text-xs text-white/40 mb-4">The main command. Runs all 9 analysis steps against an Octant project address and generates a branded PDF report.</p>
          <CodeBlock code={`./tessera analyze-project 0x9531C059098e3d194fF87FebB587aB07B30B1306 -e 5

# Optional flags:
#   -e <epoch>     Specify epoch (default: latest)
#   -n <oso-name>  OSO project name for code metrics`} label="Usage" />
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {["Funding history", "K-means clustering", "Trust graph", "4 QF simulations", "Temporal anomalies", "Multi-layer scores", "9-chain blockchain scan", "Code signals", "AI deep evaluation"].map((s, i) => (
              <div key={s} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] text-white/30">
                <span className="text-white/15 font-mono mr-1">{i + 1}.</span> {s}
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p className="text-[11px] text-white/30">Output: PDF report saved to reports/ directory. Also available via dashboard with real-time SSE streaming.</p>
          </div>
        </AccordionItem>
      </Reveal>

      <Reveal delay={350}>
        <AccordionItem title="AI Project Evaluation (8 dimensions)" tag="Primary">
          <p className="text-xs text-white/40 mb-4">Evaluate any public goods project across 8 dimensions using AI. Optionally enrich with GitHub data.</p>
          <CodeBlock code={`./tessera evaluate "Gitcoin Passport" \\
  -d "Decentralized identity verification for sybil resistance" \\
  -g "https://github.com/gitcoinco/passport"

# Flags:
#   -d <description>  Project description (required)
#   -g <github-url>   GitHub repo for enrichment (optional)
#   -c <context>      Additional context (optional)`} label="Usage" />
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {["Impact Evidence", "Team Credibility", "Innovation", "Sustainability", "Ecosystem Fit", "Transparency", "Community", "Risk Assessment"].map((d) => (
              <div key={d} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] text-white/30 text-center">{d}</div>
            ))}
          </div>
        </AccordionItem>
      </Reveal>

      {/* Quantitative Commands */}
      <Reveal delay={400}>
        <AccordionItem title="Epoch Analysis (no AI needed)" tag="Quantitative">
          <p className="text-xs text-white/40 mb-4">Analyze an entire Octant epoch. All commands are deterministic and reproducible.</p>
          <div className="space-y-3">
            <CodeBlock code={`# List all projects in an epoch
./tessera list-projects -e 5

# K-means clustering + composite scoring
./tessera analyze-epoch -e 5

# Whale concentration + coordinated donation detection
./tessera detect-anomalies -e 5

# Donor diversity, Jaccard similarity, coordination risk
./tessera trust-graph -e 5

# Compare 4 QF mechanisms side-by-side
./tessera simulate -e 5

# Full epoch intelligence report (4-step)
./tessera report-epoch -e 5`} label="Epoch Commands" />
          </div>
        </AccordionItem>
      </Reveal>

      <Reveal delay={450}>
        <AccordionItem title="Project Tracking + Blockchain Scan" tag="Quantitative">
          <p className="text-xs text-white/40 mb-4">Track a single project across epochs or scan any address across 9 EVM blockchains.</p>
          <div className="space-y-3">
            <CodeBlock code={`# Cross-epoch timeline + temporal anomalies + multi-layer scores
./tessera track-project 0x9531C059098e3d194fF87FebB587aB07B30B1306

# Scan address across 9 EVM chains (ETH, Base, OP, Arb, Mantle, Scroll, Linea, zkSync, Monad)
# Returns: balance, tx count, contract status, USDC/USDT/DAI balances
./tessera scan-chain 0x9531C059098e3d194fF87FebB587aB07B30B1306

# Gitcoin Grants round analysis
./tessera gitcoin-rounds -r 23 --chain 42161`} label="Project Commands" />
          </div>
        </AccordionItem>
      </Reveal>

      <Reveal delay={500}>
        <AccordionItem title="AI-Powered Analysis Commands" tag="AI Required">
          <p className="text-xs text-white/40 mb-4">Commands that use the AI provider chain for qualitative analysis.</p>
          <div className="space-y-3">
            <CodeBlock code={`# Multi-epoch deep evaluation with trajectory analysis
./tessera deep-eval 0x9531C059098e3d194fF87FebB587aB07B30B1306 -n "octant"

# Proposal verification: checks claims against evidence
./tessera scan-proposal "Project X" -d "We have 10,000 daily active users..."

# Extract structured impact metrics from free text
./tessera extract-metrics "Our protocol processed $2M in Q4, onboarded 500 users..."

# Collect cross-source signals (OSO + GitHub + blockchain)
./tessera collect-signals "gitcoin-passport"`} label="AI Commands" />
          </div>
        </AccordionItem>
      </Reveal>

      <Reveal delay={550}>
        <AccordionItem title="Status, Providers + Social" tag="Utility">
          <p className="text-xs text-white/40 mb-4">Check connectivity, manage AI providers, and interact on Moltbook.</p>
          <div className="space-y-3">
            <CodeBlock code={`# Check all data sources, blockchain RPCs, and AI provider status
./tessera status

# Show configured AI providers and fallback order
./tessera providers

# Moltbook social commands
./tessera moltbook status           # Agent profile, karma, followers
./tessera moltbook post             # Publish a post
./tessera moltbook reply            # Reply to a post
./tessera moltbook follow           # Follow an agent

# Auto-reply to notifications
./tessera heartbeat --loop`} label="Utility Commands" />
          </div>
        </AccordionItem>
      </Reveal>

      {/* Environment Variables */}
      <Reveal delay={600}>
        <AccordionItem title="Environment Variables" tag="Reference">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 pr-4 text-white/30 font-medium">Variable</th>
                  <th className="text-left py-2 pr-4 text-white/30 font-medium">Required</th>
                  <th className="text-left py-2 text-white/30 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="text-white/25">
                {[
                  ["ANTHROPIC_API_KEY", "1 of 3", "Claude API access"],
                  ["GEMINI_API_KEY", "1 of 3", "Google Gemini access"],
                  ["OPENAI_API_KEY", "1 of 3", "OpenAI access"],
                  ["OSO_API_KEY", "No", "Open Source Observer API"],
                  ["MOLTBOOK_API_KEY", "No", "Moltbook social network"],
                  ["PORT", "No", "Server port (default: 3001)"],
                  ["CLAUDE_CLI_DISABLED", "No", "Skip Claude CLI auto-detection"],
                ].map(([v, req, purpose]) => (
                  <tr key={v} className="border-b border-white/[0.03]">
                    <td className="py-2 pr-4 font-mono text-white/40">{v}</td>
                    <td className="py-2 pr-4">{req}</td>
                    <td className="py-2">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p className="text-[11px] text-white/30">At least one AI provider key is needed for AI commands. Quantitative commands and blockchain scanning work without any key. Claude CLI is auto-detected if the claude binary exists in PATH.</p>
          </div>
        </AccordionItem>
      </Reveal>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState("");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      const sections = NAV_LINKS.map(l => document.getElementById(l.id));
      for (let i = sections.length - 1; i >= 0; i--) {
        const s = sections[i];
        if (s && s.getBoundingClientRect().top < 200) { setActiveNav(NAV_LINKS[i].id); break; }
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="relative bg-[#0a0e1a]">

      {/* ─── Navbar ─── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0a0e1a]/90 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5">
            <img src="/tessera-icon-64.png" alt="" className="w-7 h-7" />
            <span className="text-base font-bold text-white tracking-tight">Tessera</span>
          </button>
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${activeNav === l.id ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <Link href="/dashboard" className="px-4 py-2 text-xs font-semibold rounded-full bg-blue-500 text-white hover:bg-blue-400 transition shadow-lg shadow-blue-500/20">
            Launch Dashboard
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0">
          <img src="/hero-bg.png" alt="" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e1a]/70 via-[#0a0e1a]/50 to-[#0a0e1a]" />
        </div>

        {/* Animated grid lines */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 mb-8 animate-[fadeIn_1s_ease-out]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live at yeheskieltame-tessera.hf.space
          </div>

          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight mb-6 text-white animate-[fadeIn_0.8s_ease-out]">
            Tessera
          </h1>
          <p className="text-lg sm:text-xl font-medium text-blue-300/80 mb-3 animate-[fadeIn_1s_ease-out_0.2s_both]">
            AI-Powered Public Goods Evaluation
          </p>
          <p className="text-sm text-white/40 max-w-xl mx-auto mb-10 leading-relaxed animate-[fadeIn_1s_ease-out_0.4s_both]">
            20 CLI commands. 9-step evidence pipeline. 7 data sources. 9 EVM chains.
            Trust graph analysis, mechanism simulation, and LLM-driven evaluation
            for the Octant and Gitcoin ecosystems.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap animate-[fadeIn_1s_ease-out_0.6s_both]">
            <Link href="/dashboard" className="px-7 py-3 rounded-full font-semibold text-sm bg-blue-500 text-white hover:bg-blue-400 shadow-xl shadow-blue-500/25 transition-all">
              Launch Dashboard
            </Link>
            <a href="https://github.com/yeheskieltame/Tessera" target="_blank" rel="noopener noreferrer" className="px-7 py-3 rounded-full font-semibold text-sm text-white/80 border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all">
              GitHub
            </a>
            <a href="https://github.com/yeheskieltame/Tessera/blob/main/FINDINGS.md" target="_blank" rel="noopener noreferrer" className="px-7 py-3 rounded-full font-semibold text-sm text-white/80 border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all">
              Read Findings
            </a>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative z-10 mt-20 w-full max-w-4xl">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 80}>
                <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-lg font-bold text-white">{s.value}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5">
            <div className="w-0.5 h-1.5 rounded-full bg-white/40 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ─── Problem ─── */}
      <section id="problem" className="relative py-28 px-6 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 70%, #8b5cf6 0%, transparent 50%)" }} />
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto relative">
          <Reveal>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-center text-white mb-4 tracking-tight">THE PROBLEM</h2>
            <p className="text-center text-white/40 text-base max-w-2xl mx-auto mb-16">
              Public goods evaluators in the Ethereum ecosystem face three core challenges that Tessera solves.
            </p>
          </Reveal>

          {/* Row 1: Three problems side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">

            {/* Problem 1: Cognitive Overload */}
            <Reveal delay={100}>
              <div className="h-full">
                <div className="h-48 mb-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/10 flex items-center justify-center overflow-hidden relative">
                  <svg viewBox="0 0 200 160" className="w-40 h-32 opacity-60">
                    <defs><linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#a78bfa" /></linearGradient></defs>
                    <path d="M100 20 C60 20 30 50 30 80 C30 110 55 140 100 140 C145 140 170 110 170 80 C170 50 140 20 100 20Z" fill="none" stroke="url(#brainGrad)" strokeWidth="2" />
                    <path d="M100 25 L100 135" stroke="url(#brainGrad)" strokeWidth="1" strokeDasharray="4 3" />
                    <path d="M70 40 Q80 60 65 80 Q50 100 70 120" fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.5" />
                    <path d="M130 40 Q120 60 135 80 Q150 100 130 120" fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity="0.5" />
                    <circle cx="50" cy="50" r="3" fill="#60a5fa" opacity="0.6"><animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" /></circle>
                    <circle cx="150" cy="60" r="2" fill="#a78bfa" opacity="0.4"><animate attributeName="opacity" values="0.4;0.1;0.4" dur="2.5s" repeatCount="indefinite" /></circle>
                    <circle cx="80" cy="100" r="2.5" fill="#60a5fa" opacity="0.5"><animate attributeName="opacity" values="0.5;0.15;0.5" dur="1.8s" repeatCount="indefinite" /></circle>
                    <line x1="40" y1="30" x2="25" y2="15" stroke="#f87171" strokeWidth="1" opacity="0.4"><animate attributeName="opacity" values="0;0.4;0" dur="1.5s" repeatCount="indefinite" /></line>
                    <line x1="160" y1="35" x2="175" y2="20" stroke="#f87171" strokeWidth="1" opacity="0.3"><animate attributeName="opacity" values="0;0.3;0" dur="2s" repeatCount="indefinite" /></line>
                  </svg>
                  <div className="absolute top-3 right-3 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] text-blue-300/60 font-mono animate-pulse">30+ projects</div>
                  <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-violet-500/10 border border-violet-500/20 text-[9px] text-violet-300/60 font-mono">422 donors</div>
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-wide mb-3">Cognitive Overload</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Octant distributes millions across 30+ projects per epoch. Each has funding data, donor patterns, on-chain activity, GitHub metrics, and proposals. No human can cross-reference all of this at scale.
                </p>
              </div>
            </Reveal>

            {/* Problem 2: Invisible Manipulation */}
            <Reveal delay={200}>
              <div className="h-full">
                <div className="h-48 mb-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-pink-500/5 border border-violet-500/10 flex items-center justify-center overflow-hidden relative">
                  <svg viewBox="0 0 200 160" className="w-44 h-36 opacity-60">
                    <defs><linearGradient id="chartGrad" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#ec4899" /></linearGradient></defs>
                    <line x1="30" y1="130" x2="170" y2="130" stroke="#ffffff" strokeWidth="1" opacity="0.15" />
                    <line x1="30" y1="130" x2="30" y2="20" stroke="#ffffff" strokeWidth="1" opacity="0.15" />
                    <rect x="45" y="30" width="20" height="100" rx="3" fill="url(#chartGrad)" opacity="0.7"><animate attributeName="opacity" values="0.7;0.9;0.7" dur="3s" repeatCount="indefinite" /></rect>
                    <rect x="75" y="115" width="14" height="15" rx="2" fill="#60a5fa" opacity="0.3" />
                    <rect x="97" y="110" width="14" height="20" rx="2" fill="#60a5fa" opacity="0.25" />
                    <rect x="119" y="118" width="14" height="12" rx="2" fill="#60a5fa" opacity="0.2" />
                    <rect x="141" y="120" width="14" height="10" rx="2" fill="#60a5fa" opacity="0.15" />
                    <text x="55" y="25" textAnchor="middle" fill="#f87171" fontSize="11" fontWeight="bold" opacity="0.8">97.9%</text>
                  </svg>
                  <div className="absolute top-3 left-3 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-[9px] text-rose-300/60 font-mono">Donation pattern chart</div>
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-wide mb-3">Invisible Manipulation</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Quadratic funding is vulnerable to whale dominance and coordination. A project can rank #1 while being 90% dependent on a single donor. Secret coordination patterns hide in plain sight.
                </p>
              </div>
            </Reveal>

            {/* Problem 3: Qualitative Bottleneck */}
            <Reveal delay={300}>
              <div className="h-full">
                <div className="h-48 mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-blue-500/5 border border-emerald-500/10 flex items-center justify-center overflow-hidden relative">
                  <svg viewBox="0 0 200 160" className="w-36 h-28 opacity-60">
                    <defs><linearGradient id="hourGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#60a5fa" /></linearGradient></defs>
                    <path d="M70 20 L130 20 L105 75 L130 130 L70 130 L95 75 Z" fill="none" stroke="url(#hourGrad)" strokeWidth="2" />
                    <circle cx="100" cy="60" r="1.5" fill="#34d399" opacity="0.6"><animate attributeName="cy" values="60;75;90;105;120" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.6;0.3;0" dur="2s" repeatCount="indefinite" /></circle>
                    <circle cx="97" cy="55" r="1" fill="#60a5fa" opacity="0.4"><animate attributeName="cy" values="55;70;85;100;115" dur="2.3s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.4;0.2;0" dur="2.3s" repeatCount="indefinite" /></circle>
                    <rect x="140" y="35" width="40" height="6" rx="2" fill="#ffffff" opacity="0.08" />
                    <rect x="140" y="48" width="35" height="6" rx="2" fill="#ffffff" opacity="0.06" />
                    <rect x="140" y="61" width="42" height="6" rx="2" fill="#ffffff" opacity="0.04" />
                    <path d="M136 37 L138 39.5 L142 35" stroke="#34d399" strokeWidth="1.5" fill="none" opacity="0.5" />
                    <text x="137" y="53" fill="#f87171" fontSize="7" opacity="0.3">?</text>
                    <text x="137" y="66" fill="#f87171" fontSize="7" opacity="0.3">?</text>
                  </svg>
                  <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-300/60 font-mono">8 dimensions to evaluate</div>
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-wide mb-3">Qualitative Bottleneck</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Proposal quality, team credibility, and community engagement require real-time judgment. Too slow to apply manually across dozens of projects. Cannot be automated with rules alone.
                </p>
              </div>
            </Reveal>
          </div>

          {/* Solution pill below */}
          <Reveal delay={500}>
            <div className="max-w-2xl mx-auto relative">
              <div className="absolute -inset-4 bg-blue-500/10 rounded-3xl blur-2xl" />
              <div className="relative p-6 rounded-2xl bg-[#0f1629]/90 backdrop-blur-xl border border-blue-500/20 shadow-2xl shadow-blue-500/10 text-center">
                <div className="inline-flex items-center gap-2 mb-3">
                  <img src="/tessera-icon-64.png" alt="" className="w-6 h-6" />
                  <span className="text-lg font-bold text-white">Tessera</span>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">
                  Tessera solves these by automating the full evaluation pipeline: collect data from 7 sources, run deterministic analysis, scan 9 blockchains, then feed all evidence into an LLM for synthesis.
                  For concrete evidence, read{" "}
                  <a href="https://github.com/yeheskieltame/Tessera/blob/main/FINDINGS.md" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">
                    FINDINGS.md
                  </a>.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Pipeline ─── */}
      <section id="pipeline" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="max-w-7xl mx-auto relative">
          <Reveal>
            <h2 className="text-5xl sm:text-6xl font-black text-center text-white mb-3 tracking-tight">9-STEP EVIDENCE PIPELINE</h2>
            <div className="max-w-2xl mx-auto mb-16">
              <div className="px-5 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                <p className="text-sm text-white/50">Each step produces structured data that accumulates. Steps 1-8 are deterministic. Step 9 feeds all evidence into an LLM.</p>
              </div>
            </div>
          </Reveal>

          {/* Row 1: Steps 1-4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Step 1: Funding History */}
            <Reveal delay={50}>
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-blue-500/20 transition-all group">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-medium text-white/60">1</span>
                  <span className="text-sm font-bold text-white">Funding History</span>
                </div>
                <div className="p-4">
                  <p className="text-[11px] text-white/35 mb-3">Cross-epoch allocations, matched funding, donor counts from Octant REST API</p>
                  {/* SVG: Funding bars */}
                  <div className="h-28 rounded-lg bg-white/[0.02] border border-white/5 flex items-end justify-center gap-2 px-4 pb-3 pt-2 relative">
                    <div className="absolute top-2 left-2 text-[8px] text-white/20 font-mono">ETH</div>
                    {[40, 65, 30, 55, 80, 45].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t bg-gradient-to-t from-blue-500/40 to-blue-400/60 transition-all duration-500 group-hover:from-blue-500/60 group-hover:to-blue-400/80" style={{ height: `${h}%` }} />
                        <span className="text-[7px] text-white/20">E{i + 1}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-right"><span className="text-[9px] text-blue-400/40 font-mono">Octant</span></div>
                </div>
              </div>
            </Reveal>

            {/* Step 2: Quantitative Scoring */}
            <Reveal delay={100}>
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-teal-500/20 transition-all group">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-medium text-white/60">2</span>
                  <span className="text-sm font-bold text-white">Quantitative Scoring</span>
                </div>
                <div className="p-4">
                  <p className="text-[11px] text-white/35 mb-3">K-means clustering (Lloyd&apos;s algorithm). Composite score: 40% allocated + 60% matched</p>
                  {/* SVG: Scatter plot with clusters */}
                  <div className="h-28 rounded-lg bg-white/[0.02] border border-white/5 relative overflow-hidden">
                    <svg viewBox="0 0 160 100" className="w-full h-full">
                      {/* Cluster 1 */}
                      <circle cx="35" cy="30" r="15" fill="#14b8a6" opacity="0.08" />
                      <circle cx="30" cy="28" r="2.5" fill="#14b8a6" opacity="0.6"><animate attributeName="opacity" values="0.4;0.7;0.4" dur="2s" repeatCount="indefinite" /></circle>
                      <circle cx="38" cy="35" r="2" fill="#14b8a6" opacity="0.5" />
                      <circle cx="33" cy="22" r="1.5" fill="#14b8a6" opacity="0.4" />
                      {/* Cluster 2 */}
                      <circle cx="90" cy="55" r="18" fill="#60a5fa" opacity="0.06" />
                      <circle cx="85" cy="50" r="2.5" fill="#60a5fa" opacity="0.6"><animate attributeName="opacity" values="0.5;0.8;0.5" dur="2.5s" repeatCount="indefinite" /></circle>
                      <circle cx="95" cy="58" r="2" fill="#60a5fa" opacity="0.5" />
                      <circle cx="88" cy="62" r="1.5" fill="#60a5fa" opacity="0.4" />
                      <circle cx="92" cy="48" r="2" fill="#60a5fa" opacity="0.45" />
                      {/* Cluster 3 */}
                      <circle cx="130" cy="25" r="12" fill="#a78bfa" opacity="0.06" />
                      <circle cx="128" cy="22" r="2" fill="#a78bfa" opacity="0.5" />
                      <circle cx="135" cy="28" r="1.5" fill="#a78bfa" opacity="0.4" />
                      {/* Label */}
                      <text x="80" y="92" textAnchor="middle" fill="#ffffff" fontSize="7" opacity="0.15">Composite Score</text>
                    </svg>
                  </div>
                  <div className="mt-2 text-right"><span className="text-[9px] text-teal-400/40 font-mono">Analysis</span></div>
                </div>
              </div>
            </Reveal>

            {/* Step 3: Trust Graph */}
            <Reveal delay={150}>
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-sky-500/20 transition-all group">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-medium text-white/60">3</span>
                  <span className="text-sm font-bold text-white">Trust Graph</span>
                </div>
                <div className="p-4">
                  <p className="text-[11px] text-white/35 mb-3">Shannon entropy, Jaccard similarity, and union-find donor clustering</p>
                  {/* SVG: Network graph */}
                  <div className="h-28 rounded-lg bg-white/[0.02] border border-white/5 relative overflow-hidden">
                    <svg viewBox="0 0 160 100" className="w-full h-full">
                      {/* Nodes */}
                      <circle cx="80" cy="50" r="6" fill="#0ea5e9" opacity="0.5"><animate attributeName="r" values="5;7;5" dur="3s" repeatCount="indefinite" /></circle>
                      <circle cx="40" cy="30" r="4" fill="#38bdf8" opacity="0.4" />
                      <circle cx="120" cy="25" r="4" fill="#38bdf8" opacity="0.4" />
                      <circle cx="30" cy="70" r="3.5" fill="#7dd3fc" opacity="0.35" />
                      <circle cx="130" cy="75" r="3.5" fill="#7dd3fc" opacity="0.35" />
                      <circle cx="60" cy="80" r="3" fill="#bae6fd" opacity="0.3" />
                      <circle cx="110" cy="45" r="3" fill="#bae6fd" opacity="0.3" />
                      {/* Edges */}
                      <line x1="80" y1="50" x2="40" y2="30" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.2" />
                      <line x1="80" y1="50" x2="120" y2="25" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.2" />
                      <line x1="80" y1="50" x2="30" y2="70" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.15" />
                      <line x1="80" y1="50" x2="130" y2="75" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.15" />
                      <line x1="80" y1="50" x2="60" y2="80" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.1" />
                      <line x1="80" y1="50" x2="110" y2="45" stroke="#0ea5e9" strokeWidth="0.8" opacity="0.1" />
                      <line x1="40" y1="30" x2="30" y2="70" stroke="#f87171" strokeWidth="0.8" opacity="0.2" strokeDasharray="2 2" />
                      {/* Labels */}
                      <text x="80" y="14" textAnchor="middle" fill="#ffffff" fontSize="6" opacity="0.2">Entropy</text>
                    </svg>
                  </div>
                  <div className="mt-2 text-right"><span className="text-[9px] text-sky-400/40 font-mono">Analysis</span></div>
                </div>
              </div>
            </Reveal>

            {/* Step 4: Mechanism Simulation */}
            <Reveal delay={200}>
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-amber-500/20 transition-all group">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-medium text-white/60">4</span>
                  <span className="text-sm font-bold text-white">Mechanism Simulation</span>
                </div>
                <div className="p-4">
                  <p className="text-[11px] text-white/35 mb-3">Standard QF, Capped QF, Equal-Weight, Trust-Weighted QF with Gini coefficients</p>
                  {/* SVG: 4 bar groups */}
                  <div className="h-28 rounded-lg bg-white/[0.02] border border-white/5 flex items-end justify-around px-3 pb-3 pt-2">
                    {[
                      { label: "Std", heights: [70, 30, 15], color: "#f59e0b" },
                      { label: "Cap", heights: [50, 35, 25], color: "#fb923c" },
                      { label: "Equal", heights: [33, 33, 33], color: "#34d399" },
                      { label: "Trust", heights: [45, 35, 28], color: "#a78bfa" },
                    ].map((m) => (
                      <div key={m.label} className="flex flex-col items-center gap-0.5 flex-1">
                        <div className="flex items-end gap-[2px] h-16">
                          {m.heights.map((h, j) => (
                            <div key={j} className="w-2 rounded-t transition-all duration-500" style={{ height: `${h}%`, backgroundColor: m.color, opacity: 0.3 + j * 0.15 }} />
                          ))}
                        </div>
                        <span className="text-[7px] text-white/25 mt-1">{m.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-right"><span className="text-[9px] text-amber-400/40 font-mono">Analysis</span></div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Connector arrow */}
          <Reveal delay={250}>
            <div className="flex justify-center my-2">
              <svg width="40" height="20" className="text-white/10"><path d="M20 0 L20 14 M14 10 L20 16 L26 10" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
            </div>
          </Reveal>

          {/* Row 2: Steps 5-8 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Step 5: Temporal Anomalies */}
            <Reveal delay={300}>
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-rose-500/20 transition-all">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-medium text-white/60">5</span>
                  <span className="text-sm font-bold text-white">Temporal Anomalies</span>
                </div>
                <div className="p-4">
                  <p className="text-[11px] text-white/35 mb-3">Donor surge/exodus, funding spikes, new whale entries, coordination shifts</p>
                  <div className="h-28 rounded-lg bg-white/[0.02] border border-white/5 relative overflow-hidden">
                    <svg viewBox="0 0 160 100" className="w-full h-full">
                      <polyline points="10,70 30,65 50,60 70,55 85,20 100,50 120,48 140,45 155,42" fill="none" stroke="#f87171" strokeWidth="1.5" opacity="0.4" />
                      <circle cx="85" cy="20" r="4" fill="#f87171" opacity="0.3"><animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" /></circle>
                      <text x="85" y="14" textAnchor="middle" fill="#f87171" fontSize="6" opacity="0.5">931%</text>
                      <text x="82" y="95" fill="#ffffff" fontSize="6" opacity="0.12">Whale entry</text>
                    </svg>
                  </div>
                  <div className="mt-2 text-right"><span className="text-[9px] text-rose-400/40 font-mono">Analysis</span></div>
                </div>
              </div>
            </Reveal>

            {/* Step 6: Multi-Layer Scoring */}
            <Reveal delay={350}>
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-violet-500/20 transition-all">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-medium text-white/60">6</span>
                  <span className="text-sm font-bold text-white">Multi-Layer Scoring</span>
                </div>
                <div className="p-4">
                  <p className="text-[11px] text-white/35 mb-3">5 dimensions: Funding (25%), Efficiency (25%), Diversity (30%), Consistency (20%)</p>
                  <div className="h-28 rounded-lg bg-white/[0.02] border border-white/5 flex items-end justify-center gap-3 px-4 pb-3">
                    {[
                      { label: "Fund", h: 87, color: "#8b5cf6" },
                      { label: "Eff", h: 6, color: "#a78bfa" },
                      { label: "Div", h: 11, color: "#c4b5fd" },
                      { label: "Con", h: 50, color: "#ddd6fe" },
                      { label: "ALL", h: 37, color: "#f87171" },
                    ].map((d) => (
                      <div key={d.label} className="flex flex-col items-center gap-1 flex-1">
                        <span className="text-[7px] font-mono" style={{ color: d.color, opacity: 0.6 }}>{d.h}</span>
                        <div className="w-full rounded-t" style={{ height: `${d.h}%`, backgroundColor: d.color, opacity: 0.35 }} />
                        <span className="text-[7px] text-white/20">{d.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-right"><span className="text-[9px] text-violet-400/40 font-mono">Analysis</span></div>
                </div>
              </div>
            </Reveal>

            {/* Step 7: Blockchain Scan */}
            <Reveal delay={400}>
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-emerald-500/20 transition-all">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-medium text-white/60">7</span>
                  <span className="text-sm font-bold text-white">Blockchain Scan</span>
                </div>
                <div className="p-4">
                  <p className="text-[11px] text-white/35 mb-3">9 EVM chains concurrent scan: balance, transactions, via eth_call</p>
                  <div className="h-28 rounded-lg bg-white/[0.02] border border-white/5 p-2">
                    <div className="grid grid-cols-3 gap-1 h-full">
                      {["ETH", "Base", "OP", "Arb", "Mantle", "Scroll", "Linea", "zkSync", "Monad"].map((c, i) => (
                        <div key={c} className="rounded bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center">
                          <span className="text-[8px] text-emerald-300/50 font-mono">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex gap-2">
                      <span className="text-[8px] text-emerald-400/30 font-mono">$ balance</span>
                      <span className="text-[8px] text-emerald-400/30 font-mono">33 txs</span>
                    </div>
                    <span className="text-[9px] text-emerald-400/40 font-mono">RPC</span>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Step 8: Code Signals */}
            <Reveal delay={450}>
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden hover:border-cyan-500/20 transition-all">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-xs font-medium text-white/60">8</span>
                  <span className="text-sm font-bold text-white">Code Signals</span>
                </div>
                <div className="p-4">
                  <p className="text-[11px] text-white/35 mb-3">OSO metrics or GitHub API fallback: commits, contributors</p>
                  <div className="h-28 rounded-lg bg-white/[0.02] border border-white/5 relative overflow-hidden p-3">
                    <svg viewBox="0 0 160 90" className="w-full h-full">
                      {/* Contribution heatmap */}
                      {Array.from({ length: 7 }).map((_, row) =>
                        Array.from({ length: 12 }).map((_, col) => {
                          const intensity = Math.random();
                          return <rect key={`${row}-${col}`} x={10 + col * 12} y={5 + row * 11} width="9" height="9" rx="2" fill="#06b6d4" opacity={intensity * 0.3 + 0.03} />;
                        })
                      )}
                      {/* Stats */}
                      <text x="155" y="25" textAnchor="end" fill="#06b6d4" fontSize="9" fontWeight="bold" opacity="0.4">23.5</text>
                      <text x="155" y="35" textAnchor="end" fill="#ffffff" fontSize="6" opacity="0.15">Commit count</text>
                      <text x="155" y="60" textAnchor="end" fill="#06b6d4" fontSize="9" fontWeight="bold" opacity="0.4">17</text>
                      <text x="155" y="70" textAnchor="end" fill="#ffffff" fontSize="6" opacity="0.15">Contributors</text>
                    </svg>
                  </div>
                  <div className="mt-2 text-right"><span className="text-[9px] text-cyan-400/40 font-mono">OSO/GitHub</span></div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Feed into Step 9 */}
          <Reveal delay={500}>
            <div className="text-center my-3">
              <span className="text-xs text-white/20 font-mono">Steps 1-8 feed into Step 9</span>
              <div className="flex justify-center mt-1">
                <svg width="40" height="20" className="text-white/10"><path d="M20 0 L20 14 M14 10 L20 16 L26 10" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
              </div>
            </div>
          </Reveal>

          {/* Step 9: AI Deep Evaluation - full width */}
          <Reveal delay={550}>
            <div className="rounded-2xl bg-white/[0.02] border border-indigo-500/15 overflow-hidden hover:border-indigo-500/30 transition-all relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-violet-500/5" />
              <div className="relative p-6">
                <div className="flex flex-col lg:flex-row gap-6 items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-sm font-medium text-white/70">9</span>
                      <div>
                        <h3 className="text-lg font-bold text-white">AI Deep Evaluation</h3>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-300 uppercase">AI Required</span>
                      </div>
                    </div>
                    <p className="text-sm text-white/40 leading-relaxed mb-4">
                      Evidence-grounded narrative using ALL data from steps 1-8 via LLM. Produces trajectory analysis, organic vs gaming assessment, counterfactual impact, and confidence-rated recommendation.
                    </p>
                    {/* Provider indicators */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {["Claude", "Gemini", "OpenAI"].map((p) => (
                        <span key={p} className="px-2 py-1 text-[9px] rounded bg-white/[0.03] border border-white/5 text-white/25 font-mono">{p}</span>
                      ))}
                      <span className="text-[9px] text-white/15 font-mono ml-1">AI Provider</span>
                    </div>
                  </div>
                  {/* Output: PDF Report */}
                  <div className="flex-shrink-0 w-40">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-center relative">
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                        <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                      </div>
                      <img src="/tessera-icon-64.png" alt="" className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-bold text-white/60">Tessera Report</p>
                      <p className="text-[9px] text-white/25 mt-1">Branded PDF</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-[11px] text-white/25">
                    Output: Branded PDF report with funding history, trust profile, multi-layer scores, mechanism simulation, temporal anomalies, blockchain activity, and AI narrative assessment.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Architecture ─── */}
      <section id="architecture" className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />

        <div className="max-w-7xl mx-auto relative">
          <SectionHeading
            title="System Architecture"
            subtitle="Go binary (9MB) serves CLI + HTTP API + static frontend. Single process, zero dependencies."
          />

          {/* Main architecture diagram as SVG flowchart */}
          <Reveal>
            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 sm:p-8 mb-10 overflow-x-auto">
              <svg viewBox="0 0 900 420" className="w-full min-w-[700px]" style={{ maxHeight: "480px" }}>
                <defs>
                  <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient>
                  <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient>
                  <marker id="arrowHead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#ffffff" opacity="0.15" /></marker>
                </defs>

                {/* === USER === */}
                <rect x="380" y="10" width="140" height="40" rx="20" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.15" />
                <text x="450" y="35" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="600" opacity="0.5">User</text>

                {/* Arrows from User */}
                <line x1="420" y1="50" x2="200" y2="90" stroke="#ffffff" strokeWidth="0.8" opacity="0.1" markerEnd="url(#arrowHead)" />
                <line x1="480" y1="50" x2="700" y2="90" stroke="#ffffff" strokeWidth="0.8" opacity="0.1" markerEnd="url(#arrowHead)" />

                {/* === CLI === */}
                <rect x="100" y="90" width="200" height="50" rx="8" fill="#3b82f6" fillOpacity="0.08" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.2" />
                <text x="200" y="113" textAnchor="middle" fill="#60a5fa" fontSize="11" fontWeight="700">CLI (20 commands)</text>
                <text x="200" y="128" textAnchor="middle" fill="#ffffff" fontSize="8" opacity="0.25">cmd/analyst/main.go</text>

                {/* === Dashboard === */}
                <rect x="600" y="90" width="200" height="50" rx="8" fill="#8b5cf6" fillOpacity="0.08" stroke="#8b5cf6" strokeWidth="1" strokeOpacity="0.2" />
                <text x="700" y="113" textAnchor="middle" fill="#a78bfa" fontSize="11" fontWeight="700">Next.js Dashboard</text>
                <text x="700" y="128" textAnchor="middle" fill="#ffffff" fontSize="8" opacity="0.25">SSE Streaming + PDF Viewer</text>

                {/* Arrow: Dashboard -> Server */}
                <line x1="700" y1="140" x2="700" y2="170" stroke="#8b5cf6" strokeWidth="0.8" opacity="0.2" markerEnd="url(#arrowHead)" />
                <text x="720" y="160" fill="#ffffff" fontSize="7" opacity="0.15">HTTP/SSE</text>

                {/* Arrow: CLI -> modules */}
                <line x1="200" y1="140" x2="200" y2="170" stroke="#3b82f6" strokeWidth="0.8" opacity="0.2" markerEnd="url(#arrowHead)" />

                {/* === HTTP SERVER === */}
                <rect x="500" y="170" width="300" height="45" rx="8" fill="#ffffff" fillOpacity="0.02" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.1" />
                <text x="650" y="193" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="600" opacity="0.4">HTTP Server (19 endpoints + 4 SSE)</text>
                <text x="650" y="206" textAnchor="middle" fill="#ffffff" fontSize="7" opacity="0.15">internal/server/server.go</text>

                {/* === TESSERA CORE (big box) === */}
                <rect x="50" y="170" width="410" height="230" rx="10" fill="#ffffff" fillOpacity="0.015" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.08" strokeDasharray="4 2" />
                <text x="70" y="192" fill="#ffffff" fontSize="9" fontWeight="600" opacity="0.2">TESSERA BINARY</text>

                {/* Data Layer */}
                <rect x="70" y="200" width="170" height="185" rx="6" fill="#10b981" fillOpacity="0.04" stroke="#10b981" strokeWidth="0.6" strokeOpacity="0.12" />
                <text x="155" y="218" textAnchor="middle" fill="#34d399" fontSize="9" fontWeight="600" opacity="0.5">DATA LAYER</text>

                {[
                  { y: 228, name: "Octant", proto: "REST" },
                  { y: 248, name: "Gitcoin", proto: "GraphQL" },
                  { y: 268, name: "OSO", proto: "GraphQL" },
                  { y: 288, name: "GitHub", proto: "REST" },
                  { y: 308, name: "Blockchain", proto: "RPC" },
                  { y: 328, name: "Explorers", proto: "REST" },
                  { y: 348, name: "Moltbook", proto: "REST" },
                ].map((src) => (
                  <g key={src.name}>
                    <text x="90" y={src.y} fill="#ffffff" fontSize="8" opacity="0.3">{src.name}</text>
                    <text x="220" y={src.y} textAnchor="end" fill="#34d399" fontSize="7" opacity="0.25" fontFamily="monospace">{src.proto}</text>
                  </g>
                ))}

                {/* Analysis Layer */}
                <rect x="260" y="200" width="185" height="130" rx="6" fill="#8b5cf6" fillOpacity="0.04" stroke="#8b5cf6" strokeWidth="0.6" strokeOpacity="0.12" />
                <text x="352" y="218" textAnchor="middle" fill="#a78bfa" fontSize="9" fontWeight="600" opacity="0.5">ANALYSIS LAYER</text>

                {[
                  { y: 234, name: "Quantitative", desc: "K-means, scoring" },
                  { y: 254, name: "Trust Graph", desc: "Entropy, Jaccard" },
                  { y: 274, name: "Mechanism", desc: "4 QF simulations" },
                  { y: 294, name: "Qualitative", desc: "LLM evaluation" },
                ].map((mod) => (
                  <g key={mod.name}>
                    <text x="280" y={mod.y} fill="#ffffff" fontSize="8" opacity="0.35">{mod.name}</text>
                    <text x="428" y={mod.y} textAnchor="end" fill="#a78bfa" fontSize="7" opacity="0.2" fontFamily="monospace">{mod.desc}</text>
                  </g>
                ))}

                {/* Provider + Report */}
                <rect x="260" y="340" width="90" height="45" rx="6" fill="#f59e0b" fillOpacity="0.04" stroke="#f59e0b" strokeWidth="0.6" strokeOpacity="0.12" />
                <text x="305" y="358" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="600" opacity="0.4">AI Provider</text>
                <text x="305" y="372" textAnchor="middle" fill="#ffffff" fontSize="7" opacity="0.15">4 providers</text>

                <rect x="360" y="340" width="85" height="45" rx="6" fill="#ec4899" fillOpacity="0.04" stroke="#ec4899" strokeWidth="0.6" strokeOpacity="0.12" />
                <text x="402" y="358" textAnchor="middle" fill="#f472b6" fontSize="8" fontWeight="600" opacity="0.4">PDF Report</text>
                <text x="402" y="372" textAnchor="middle" fill="#ffffff" fontSize="7" opacity="0.15">go-pdf/fpdf</text>

                {/* === EXTERNAL APIS === */}
                <rect x="500" y="230" width="300" height="175" rx="10" fill="#ffffff" fillOpacity="0.01" stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.06" strokeDasharray="4 2" />
                <text x="520" y="250" fill="#ffffff" fontSize="9" fontWeight="600" opacity="0.2">EXTERNAL APIS</text>

                {[
                  { y: 268, name: "Octant REST API", url: "backend.mainnet.octant.app" },
                  { y: 288, name: "Gitcoin GraphQL", url: "grants-stack-indexer-v2.gitcoin.co" },
                  { y: 308, name: "OSO GraphQL", url: "opensource.observer" },
                  { y: 328, name: "GitHub REST", url: "api.github.com" },
                  { y: 348, name: "9 EVM RPCs", url: "publicnode, base.org, optimism.io..." },
                  { y: 368, name: "Claude / Gemini / OpenAI", url: "AI Provider APIs" },
                  { y: 388, name: "Block Explorers", url: "Etherscan-compatible" },
                ].map((api) => (
                  <g key={api.name}>
                    <text x="520" y={api.y} fill="#ffffff" fontSize="8" opacity="0.3">{api.name}</text>
                    <text x="780" y={api.y} textAnchor="end" fill="#ffffff" fontSize="6" opacity="0.12" fontFamily="monospace">{api.url}</text>
                  </g>
                ))}

                {/* Flow arrows: Data -> External */}
                <line x1="240" y1="300" x2="500" y2="300" stroke="url(#greenGrad)" strokeWidth="0.8" opacity="0.15" markerEnd="url(#arrowHead)" />
                <line x1="500" y1="300" x2="240" y2="300" stroke="url(#greenGrad)" strokeWidth="0.8" opacity="0.1" strokeDasharray="3 3" />

                {/* Flow: Server -> Core */}
                <line x1="500" y1="195" x2="460" y2="195" stroke="#ffffff" strokeWidth="0.6" opacity="0.08" markerEnd="url(#arrowHead)" />

                {/* Animated data pulse */}
                <circle r="3" fill="#3b82f6" opacity="0.4">
                  <animateMotion dur="4s" repeatCount="indefinite" path="M240,300 L500,300" />
                  <animate attributeName="opacity" values="0.5;0.1;0.5" dur="4s" repeatCount="indefinite" />
                </circle>
                <circle r="2" fill="#10b981" opacity="0.3">
                  <animateMotion dur="5s" repeatCount="indefinite" path="M500,300 L240,300" />
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="5s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
          </Reveal>

          {/* Blockchain Chains row */}
          <Reveal>
            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Multi-Chain Scanner (9 EVM Chains)</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-10">
              {CHAINS.map((c, i) => (
                <Reveal key={c.name} delay={i * 30}>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center hover:border-emerald-500/15 transition-all">
                    <p className="text-[11px] font-semibold text-white/60">{c.name}</p>
                    <p className="text-[9px] text-white/20 mt-0.5">{c.token}</p>
                    <p className="text-[8px] text-white/10 mt-0.5">{c.stables}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          {/* AI Provider fallback */}
          <Reveal>
            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">AI Provider Fallback Chain</h3>
            <div className="flex flex-col sm:flex-row items-stretch gap-0">
              {PROVIDERS.map((p, i) => (
                <Reveal key={p.name} delay={i * 80} className="flex-1 flex">
                  <div className="flex-1 flex items-center">
                    <div className={`flex-1 p-4 rounded-xl bg-white/[0.02] border border-white/5 ${i === 0 ? "border-blue-500/15" : ""}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-white/60">{p.name}</span>
                        {i === 0 && <span className="text-[8px] px-1.5 py-0.5 rounded-full border border-blue-500/20 text-blue-400/50">primary</span>}
                      </div>
                      <p className="text-[10px] text-white/20 font-mono">{p.models}</p>
                      <p className="text-[9px] text-white/12 mt-1">{p.auth}</p>
                    </div>
                    {i < PROVIDERS.length - 1 && (
                      <div className="hidden sm:flex w-6 items-center justify-center flex-shrink-0">
                        <svg width="16" height="12" className="text-white/15"><path d="M0 6 L10 6 M7 3 L11 6 L7 9" stroke="currentColor" strokeWidth="1" fill="none" /></svg>
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="text-[10px] text-white/15 mt-3 text-center">120s timeout per request. If preferred provider fails, next is tried automatically.</p>
          </Reveal>
        </div>
      </section>

      {/* ─── Algorithms ─── */}
      <section id="algorithms" className="relative py-28 px-6 overflow-hidden">
        {/* Subtle background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-500/[0.03] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/[0.03] rounded-full blur-[100px]" />
        </div>

        <div className="max-w-6xl mx-auto relative">
          <SectionHeading
            title="Analysis Algorithms"
            subtitle="Deterministic, reproducible analysis using established mathematical methods. Every formula is transparent and auditable."
          />

          {/* Top row: 2 large cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            {ALGORITHMS.slice(0, 2).map((a, i) => (
              <Reveal key={a.name} delay={i * 100}>
                <div className="group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-violet-500/10 transition-all h-full relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/[0.03] rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-white">{a.name}</h3>
                      <span className="text-[9px] px-2 py-0.5 rounded-full border border-violet-500/15 text-violet-400/40 font-mono">formula</span>
                    </div>
                    <div className="px-4 py-3 rounded-xl bg-[#0d1117] border border-[#30363d] mb-4 font-mono">
                      <code className="text-sm text-violet-300/90 leading-relaxed">{a.formula}</code>
                    </div>
                    <p className="text-sm text-white/40 leading-relaxed">{a.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Bottom row: 4 compact cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ALGORITHMS.slice(2).map((a, i) => (
              <Reveal key={a.name} delay={(i + 2) * 100}>
                <div className="group p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-violet-500/10 transition-all h-full relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/[0.03] rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative">
                    <h3 className="text-sm font-bold text-white mb-3">{a.name}</h3>
                    <div className="px-3 py-2 rounded-lg bg-[#0d1117] border border-[#30363d] mb-3 font-mono">
                      <code className="text-[11px] text-violet-300/80 leading-relaxed">{a.formula}</code>
                    </div>
                    <p className="text-[11px] text-white/35 leading-relaxed">{a.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Findings ─── */}
      <section id="findings" className="relative py-28 px-6 overflow-hidden">
        {/* Animated background glow */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-500/[0.04] rounded-full blur-[150px]" />
        </div>
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="max-w-6xl mx-auto relative">
          <Reveal>
            <h2 className="text-5xl sm:text-6xl font-black text-center text-white mb-4 tracking-tight">KEY FINDINGS</h2>
            <p className="text-center text-white/40 text-base max-w-2xl mx-auto mb-6">
              Real insights from Octant Epoch 5: 30 projects, 1,902 donations, 422 unique donors.
            </p>
            <p className="text-center text-white/25 text-sm max-w-xl mx-auto mb-16">
              All findings are reproducible by running Tessera CLI commands. For full methodology and interpretation, read{" "}
              <a href="https://github.com/yeheskieltame/Tessera/blob/main/FINDINGS.md" target="_blank" rel="noopener noreferrer" className="text-blue-400/70 underline underline-offset-2 hover:text-blue-400">
                FINDINGS.md
              </a>.
            </p>
          </Reveal>

          {/* Top: 2 hero findings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            {FINDINGS.slice(0, 2).map((f, i) => (
              <Reveal key={f.label} delay={i * 100}>
                <div className="group relative p-6 rounded-2xl border border-white/5 hover:border-blue-500/15 transition-all overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative flex items-start gap-5">
                    <div className="flex-shrink-0">
                      <p className="text-5xl font-black bg-gradient-to-b from-blue-400 to-blue-600 bg-clip-text text-transparent leading-none">{f.stat}</p>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">{f.label}</p>
                      <p className="text-sm text-white/35 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Bottom: 4 compact findings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {FINDINGS.slice(2).map((f, i) => (
              <Reveal key={f.label} delay={(i + 2) * 80}>
                <div className="group relative p-5 rounded-2xl border border-white/5 hover:border-blue-500/15 transition-all overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative">
                    <p className="text-3xl font-black bg-gradient-to-b from-blue-400 to-blue-500 bg-clip-text text-transparent mb-2 leading-none">{f.stat}</p>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-2">{f.label}</p>
                    <p className="text-[11px] text-white/30 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* CTA to FINDINGS.md */}
          <Reveal delay={500}>
            <div className="text-center">
              <a
                href="https://github.com/yeheskieltame/Tessera/blob/main/FINDINGS.md"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 px-8 py-3.5 rounded-full text-sm font-semibold text-white/70 border border-white/10 hover:border-blue-500/25 hover:text-blue-400 transition-all"
              >
                Read Full Analysis in FINDINGS.md
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Setup ─── */}
      <section id="setup" className="relative py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <SectionHeading
            title="Get Started"
            subtitle="From zero to a running dashboard, or try the live demo instantly. Click each section below to expand."
          />

          <Reveal>
            <div className="mb-10 p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
              <p className="text-sm text-emerald-300/70 mb-3">Skip setup and try it now:</p>
              <a
                href="https://yeheskieltame-tessera.hf.space"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Open Live Demo
              </a>
            </div>
          </Reveal>

          <SetupAccordion />
        </div>
      </section>

      {/* ─── Team ─── */}
      <section className="relative py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <SectionHeading
            title="Team"
            subtitle="Built for The Synthesis hackathon. Human and Agent collaborating as equals."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Reveal>
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="text-[10px] text-white/20 uppercase tracking-wider mb-3">Human</div>
                <h3 className="text-lg font-bold text-white mb-1">Yeheskiel Yunus Tame</h3>
                <a href="https://x.com/YeheskielTame" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400">@YeheskielTame</a>
                <p className="text-xs text-white/30 mt-3">Direction, domain context, decision-making, GitHub repo management.</p>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="text-[10px] text-white/20 uppercase tracking-wider mb-3">Agent</div>
                <h3 className="text-lg font-bold text-white mb-1">Synthesis Agent <span className="text-white/30 font-mono text-sm">#32417</span></h3>
                <p className="text-xs text-blue-400">Claude Opus 4.6 via Claude Code</p>
                <p className="text-xs text-white/30 mt-3">Architecture, algorithms, implementation, documentation, deployment.</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] text-white/15 font-mono">ERC-8004 on Base</span>
                  <a href="https://basescan.org/tx/0x2ef2402a1528f7841e880fd90b2246fbee688e0ab2e922f4163c7b291891451b" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400/50 hover:text-blue-400 underline underline-offset-2">
                    View TX
                  </a>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Tracks", value: "4" },
                { label: "Prize Pool", value: "$31,308" },
                { label: "Commits", value: "69+" },
                { label: "Phases", value: "48" },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                  <p className="text-lg font-bold text-white">{s.value}</p>
                  <p className="text-[10px] text-white/25 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to evaluate?</h2>
            <p className="text-sm text-white/40 mb-8 max-w-md mx-auto">
              Launch the dashboard, enter a project address, and get a full intelligence report in minutes.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/dashboard" className="px-8 py-3.5 rounded-full font-semibold text-sm bg-blue-500 text-white hover:bg-blue-400 shadow-xl shadow-blue-500/25 transition-all">
                Launch Dashboard
              </Link>
              <a href="https://yeheskieltame-tessera.hf.space" target="_blank" rel="noopener noreferrer" className="px-8 py-3.5 rounded-full font-semibold text-sm text-white/70 border border-white/15 hover:border-white/30 transition-all">
                Live Demo
              </a>
              <a href="https://github.com/yeheskieltame/Tessera" target="_blank" rel="noopener noreferrer" className="px-8 py-3.5 rounded-full font-semibold text-sm text-white/70 border border-white/15 hover:border-white/30 transition-all">
                GitHub
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/tessera-icon-64.png" alt="" className="w-5 h-5 opacity-50" />
            <span className="text-sm font-bold text-white/50">Tessera</span>
          </div>
          <p className="text-xs text-white/25">
            Built by Yeheskiel Yunus Tame + Synthesis Agent #32417 (Claude Opus 4.6)
          </p>
          <p className="text-xs text-white/15 mt-2">
            The Synthesis Hackathon
            {" | "}
            <a href="https://github.com/yeheskieltame/Tessera" target="_blank" rel="noopener noreferrer" className="text-blue-400/40 hover:text-blue-400">GitHub</a>
            {" | "}
            <a href="https://github.com/yeheskieltame/Tessera/blob/main/FINDINGS.md" target="_blank" rel="noopener noreferrer" className="text-blue-400/40 hover:text-blue-400">Findings</a>
            {" | "}
            <a href="https://github.com/yeheskieltame/Tessera/blob/main/CONVERSATION_LOG.md" target="_blank" rel="noopener noreferrer" className="text-blue-400/40 hover:text-blue-400">Collaboration Log</a>
          </p>
        </div>
      </footer>

      {/* ─── CSS Animations ─── */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
