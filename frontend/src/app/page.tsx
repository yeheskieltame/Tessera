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
      <section id="pipeline" className="relative py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            title="9-Step Evidence Pipeline"
            subtitle="Each step produces structured data that accumulates. Steps 1-8 are deterministic. Step 9 feeds all evidence into an LLM."
          />
          <div className="space-y-3">
            {PIPELINE_STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 60}>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all group">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                    <span className="text-sm font-bold text-white">{step.num}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-white">{step.title}</h3>
                      {step.ai && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-300 uppercase">AI</span>}
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">{step.desc}</p>
                  </div>
                  <div className="flex-shrink-0 hidden sm:block">
                    <span className="text-[10px] text-white/20 font-mono">{step.source}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Flow arrow */}
          <Reveal delay={600}>
            <div className="mt-8 flex items-center justify-center gap-2 text-white/20">
              <div className="h-px flex-1 max-w-[100px] bg-gradient-to-r from-transparent to-white/10" />
              <span className="text-xs font-mono">Steps 1-8 feed into Step 9</span>
              <div className="h-px flex-1 max-w-[100px] bg-gradient-to-l from-transparent to-white/10" />
            </div>
            <div className="mt-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-center">
              <p className="text-xs text-indigo-300/60">
                Output: Branded PDF report with funding history, trust profile, multi-layer scores, mechanism simulation,
                temporal anomalies, blockchain activity, and AI narrative assessment.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Architecture ─── */}
      <section id="architecture" className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title="System Architecture"
            subtitle="Go binary (9MB) serves both CLI and HTTP API. Next.js dashboard connects via SSE streaming."
          />

          {/* Data Sources */}
          <Reveal>
            <h3 className="text-lg font-bold text-white mb-4">Data Sources</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-12">
              {DATA_SOURCES.map((s, i) => (
                <Reveal key={s.name} delay={i * 60}>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 h-full">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-white">{s.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 font-mono">{s.protocol}</span>
                    </div>
                    <p className="text-[11px] text-white/30 leading-relaxed">{s.data}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          {/* Blockchain Chains */}
          <Reveal>
            <h3 className="text-lg font-bold text-white mb-4">Multi-Chain Blockchain Scanner</h3>
            <p className="text-sm text-white/40 mb-6">Scans addresses across 9 EVM chains concurrently via goroutines. No API keys needed. Typical scan: 2-3 seconds.</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-12">
              {CHAINS.map((c, i) => (
                <Reveal key={c.name} delay={i * 40}>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center hover:border-emerald-500/20 transition-all">
                    <p className="text-xs font-bold text-white mb-0.5">{c.name}</p>
                    <p className="text-[10px] text-white/30">{c.token}</p>
                    <p className="text-[9px] text-white/15 mt-1">{c.stables}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          {/* AI Providers */}
          <Reveal>
            <h3 className="text-lg font-bold text-white mb-4">AI Provider Fallback Chain</h3>
            <p className="text-sm text-white/40 mb-6">Providers tried in order. If preferred fails, auto-fallback to next. 120s timeout per request.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              {PROVIDERS.map((p, i) => (
                <Reveal key={p.name} delay={i * 100} className="flex-1">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 h-full relative">
                    {i === 0 && <div className="absolute -top-2 left-3 px-2 py-0.5 bg-blue-500 text-[9px] font-bold text-white rounded-full uppercase">Primary</div>}
                    <h4 className="text-xs font-bold text-white mb-2 mt-1">{p.name}</h4>
                    <p className="text-[10px] text-white/30 font-mono mb-1">{p.models}</p>
                    <p className="text-[10px] text-white/20">{p.auth}</p>
                    {i < PROVIDERS.length - 1 && (
                      <div className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-5 h-5 rounded-full bg-[#0a0e1a] border border-white/10 items-center justify-center">
                        <span className="text-[10px] text-white/30">&rarr;</span>
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Algorithms ─── */}
      <section id="algorithms" className="relative py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            title="Analysis Algorithms"
            subtitle="Deterministic, reproducible analysis using established mathematical methods."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALGORITHMS.map((a, i) => (
              <Reveal key={a.name} delay={i * 80}>
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-violet-500/15 transition-all h-full">
                  <h3 className="text-sm font-bold text-white mb-2">{a.name}</h3>
                  <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 mb-3">
                    <code className="text-xs text-violet-300/80 font-mono">{a.formula}</code>
                  </div>
                  <p className="text-xs text-white/35 leading-relaxed">{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Findings ─── */}
      <section id="findings" className="relative py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            title="Key Findings from Real Data"
            subtitle="Octant Epoch 5: 30 projects, 1,902 donations, 422 unique donors. All findings reproducible via CLI."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FINDINGS.map((f, i) => (
              <Reveal key={f.label} delay={i * 80}>
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-blue-500/15 transition-all h-full">
                  <p className="text-3xl font-black text-blue-400 mb-1">{f.stat}</p>
                  <p className="text-xs font-bold text-white mb-2 uppercase tracking-wider">{f.label}</p>
                  <p className="text-xs text-white/35 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={500}>
            <div className="mt-8 text-center">
              <a
                href="https://github.com/yeheskieltame/Tessera/blob/main/FINDINGS.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-blue-400 border border-blue-500/20 hover:bg-blue-500/5 transition-all"
              >
                Read Full Analysis in FINDINGS.md
                <span>&rarr;</span>
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
            subtitle="From zero to a running dashboard. Or try the live demo instantly."
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

          <div className="space-y-4">
            {SETUP_STEPS.map((s, i) => (
              <Reveal key={s.num} delay={i * 100}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-lg">
                    <span className="text-sm font-bold text-white">{s.num}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white mb-2">{s.title}</h3>
                    <CodeBlock code={s.code} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
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
