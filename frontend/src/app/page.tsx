"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ─── Data ─── */
const findings = [
  { stat: "97.9%", label: "Whale Concentration", desc: "Top donors control nearly all funding in most Octant projects" },
  { stat: "41", label: "Donor Clusters", desc: "Detected coordinated donation patterns across epochs" },
  { stat: "3,105%", label: "Mechanism Impact", desc: "Trust-weighted QF redistributes up to 31x more to undervalued projects" },
];

const features = [
  {
    img: "/feat-trust.png",
    title: "Trust Graph Analysis",
    desc: "Map donor-project relationships with Jaccard similarity, Shannon entropy, sybil detection, and whale dependency scoring. Identify coordinated donation patterns and flag suspicious behavior across the entire funding network.",
  },
  {
    img: "/feat-ai.png",
    title: "Deep AI Evaluation",
    desc: "Claude Opus 4.6 scores projects across 8 dimensions: Impact, Team, Innovation, Sustainability, Ecosystem Fit, Transparency, Community Engagement, and Risk Assessment. Each evaluation produces actionable recommendations.",
  },
  {
    img: "/feat-report.png",
    title: "PDF Intelligence Reports",
    desc: "Generate branded, watermarked PDF reports with executive summaries, quantitative analysis, trust graph visualizations, mechanism comparisons, and prioritized recommendations for each project.",
  },
  {
    img: null,
    title: "Mechanism Simulation",
    desc: "Compare four QF variants side-by-side: Standard, Capped, Equal-Weight, and Trust-Weighted. Analyze Gini coefficients, top-share concentration, and fairness metrics to design better funding mechanisms.",
  },
];

const steps = [
  { num: "01", title: "Clone & Build", code: "git clone https://github.com/yeheskieltame/Tessera.git\ncd Tessera && go build -o tessera ./cmd/analyst/" },
  { num: "02", title: "Setup AI", code: "# Option A: Claude Code Max plan (auto-detected)\n# Option B: Set API key\nexport ANTHROPIC_API_KEY=\"sk-ant-...\"" },
  { num: "03", title: "Start Server", code: "./tessera serve" },
  { num: "04", title: "Open Dashboard", code: "# Open in your browser\nhttp://localhost:8080" },
];

const stats = [
  { value: "20", label: "CLI Commands" },
  { value: "7", label: "Data Sources" },
  { value: "4", label: "QF Mechanisms" },
  { value: "9-Step", label: "Pipeline" },
];

/* ─── Smooth scroll helper ─── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

/* ─── Code block with copy ─── */
function MiniCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-sm overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-3 right-3 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative overflow-hidden">

      {/* ─── Navbar (sticky, glass) ─── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-slate-900/80 backdrop-blur-xl border-b border-white/10 shadow-lg" : "bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <img src="/tessera-icon-64.png" alt="Tessera" className="w-8 h-8" />
              <span className="text-lg font-bold text-white tracking-tight">Tessera</span>
            </div>
            <div className="hidden sm:flex items-center gap-6">
              <button onClick={() => scrollTo("features")} className="text-sm text-white/70 hover:text-white transition">What It Does</button>
              <button onClick={() => scrollTo("get-started")} className="text-sm text-white/70 hover:text-white transition">Get Started</button>
              <a href="https://github.com/yeheskieltame/Tessera" target="_blank" rel="noopener noreferrer" className="text-sm text-white/70 hover:text-white transition">GitHub</a>
            </div>
          </div>
          <Link href="/dashboard" className="px-5 py-2 text-sm font-semibold rounded-full bg-blue-500/80 backdrop-blur-md text-white hover:bg-blue-500/90 shadow-lg shadow-blue-500/25 transition">
            Launch Dashboard
          </Link>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-32">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img src="/hero-bg.png" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/80 via-[#0f172a]/60 to-[#0f172a]/90" />
        </div>

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <img src="/tessera-icon-inverted-256.png" alt="Tessera" className="w-24 h-24 mx-auto mb-6 drop-shadow-2xl" />
          <h1 className="text-7xl sm:text-8xl font-black tracking-tight mb-6 text-white">
            Tessera
          </h1>
          <p className="text-xl sm:text-2xl font-semibold text-blue-200 mb-4">
            AI-Powered Public Goods Evaluation
          </p>
          <p className="text-base text-white/60 max-w-xl mx-auto mb-10 leading-relaxed">
            Automate quantitative analysis, trust graph evaluation, and mechanism simulation
            to help evaluators make better funding decisions in the Octant and Gitcoin ecosystems.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href="https://github.com/yeheskieltame/Tessera"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 rounded-full font-semibold text-white border border-white/30 bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200"
            >
              View on GitHub
            </a>
            <button
              onClick={() => scrollTo("get-started")}
              className="px-8 py-3.5 rounded-full font-semibold bg-blue-500/80 backdrop-blur-md text-white hover:bg-blue-500/90 shadow-lg shadow-blue-500/25 transition-all duration-200"
            >
              Get Started
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center pt-2">
            <div className="w-1 h-2 rounded-full bg-white/60 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ─── Key Findings Section ─── */}
      <section className="relative bg-[#0f172a] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">
            What We Found
          </h2>
          <p className="text-center text-white/50 mb-14 max-w-xl mx-auto">
            Real insights from analyzing Octant&apos;s quadratic funding data across multiple epochs.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {findings.map((f) => (
              <div key={f.label} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-all duration-300">
                <p className="text-4xl font-black text-blue-400 mb-2">{f.stat}</p>
                <p className="text-sm font-semibold text-white mb-2">{f.label}</p>
                <p className="text-xs text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── What It Does (alternating rows) ─── */}
      <section id="features" className="relative py-24 px-6 bg-gradient-to-b from-[#0f172a] to-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">
            What It Does
          </h2>
          <p className="text-center text-white/50 mb-16 max-w-xl mx-auto">
            Four core capabilities to evaluate public goods projects at scale.
          </p>

          <div className="space-y-20">
            {features.map((f, i) => {
              const imgLeft = i % 2 === 0;
              const isDark = i < 2; // first two rows are on dark bg

              const imageBlock = f.img ? (
                <div className="flex-shrink-0 w-full lg:w-[40%]">
                  <div className={`rounded-2xl overflow-hidden ${isDark ? "bg-white/5 border border-white/10" : "bg-white/70 border border-slate-100 shadow-lg"}`}>
                    <img src={f.img} alt={f.title} className="w-full h-auto object-cover" />
                  </div>
                </div>
              ) : (
                <div className="flex-shrink-0 w-full lg:w-[40%]">
                  <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-violet-600 aspect-square flex items-center justify-center">
                    <svg className="w-24 h-24 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              );

              const textBlock = (
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className={`text-2xl font-bold mb-4 ${isDark ? "text-white" : "text-slate-800"}`}>{f.title}</h3>
                  <p className={`text-base leading-relaxed ${isDark ? "text-white/60" : "text-slate-500"}`}>{f.desc}</p>
                </div>
              );

              return (
                <div key={f.title} className="flex flex-col lg:flex-row items-center gap-10">
                  {imgLeft ? <>{imageBlock}{textBlock}</> : <>{textBlock}{imageBlock}</>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Get Started Section ─── */}
      <section id="get-started" className="relative py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-4">
            Get Started in 4 Steps
          </h2>
          <p className="text-center text-slate-500 mb-14 max-w-xl mx-auto">
            From zero to a running dashboard in under 5 minutes.
          </p>

          {/* Horizontal timeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.num} className="relative">
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-[calc(50%+24px)] w-[calc(100%-48px)] h-0.5 bg-gradient-to-r from-blue-300 to-blue-100" style={{ left: "calc(50% + 20px)", width: "calc(100% - 10px)" }} />
                )}
                <div className="bg-white/70 backdrop-blur-md border border-slate-100 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow h-full">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg shadow-md mb-4">
                    {s.num}
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-3">{s.title}</h3>
                  <MiniCode code={s.code} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats Row ─── */}
      <section className="relative py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-white/70 backdrop-blur-md border border-slate-100 rounded-2xl p-5 text-center shadow-lg">
                <p className="text-2xl font-black bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent mb-1">{s.value}</p>
                <p className="text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Call to Action ─── */}
      <section className="relative py-24 px-6 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">
            Ready to analyze?
          </h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Launch the dashboard and start evaluating public goods projects with AI-powered intelligence.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/dashboard"
              className="px-10 py-4 rounded-full font-semibold text-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 transition-all duration-200"
            >
              Launch Dashboard
            </Link>
            <a
              href="https://github.com/yeheskieltame/Tessera"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-4 rounded-full font-semibold text-lg text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
            >
              View Documentation
            </a>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-100 py-12 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/tessera-icon-64.png" alt="Tessera" className="w-6 h-6" />
            <span className="text-sm font-bold text-slate-700">Tessera</span>
          </div>
          <p className="text-sm text-slate-600">
            Built by{" "}
            <span className="font-semibold text-slate-800">Yeheskiel Yunus Tame</span>
            {" "}+{" "}
            <span className="font-semibold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Claude Opus 4.6</span>
          </p>
          <p className="text-xs text-slate-400 mt-2">
            The Synthesis Hackathon &middot;{" "}
            <a href="https://github.com/yeheskieltame/Tessera" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
