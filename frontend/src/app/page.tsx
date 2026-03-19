"use client";

import GlassCard from "@/components/GlassCard";
import CodeBlock from "@/components/CodeBlock";
import Link from "next/link";

const features = [
  {
    icon: (
      <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Trust Graph Analysis",
    desc: "Jaccard similarity, Shannon entropy, sybil detection, and whale dependency scoring for every project.",
  },
  {
    icon: (
      <svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Mechanism Simulation",
    desc: "Compare QF variants: Standard, Capped, Equal-weight, and Trust-Weighted with Gini coefficients and fairness metrics.",
  },
  {
    icon: (
      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: "Deep AI Evaluation",
    desc: "Claude Opus 4.6 scores projects across 8 dimensions: Impact, Team, Innovation, Sustainability, Ecosystem, Transparency, Community, Risk.",
  },
  {
    icon: (
      <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "PDF Intelligence Reports",
    desc: "Branded, watermarked PDF reports with executive summaries, charts, and actionable recommendations.",
  },
];

const steps = [
  {
    num: "01",
    title: "Clone & Build",
    code: "git clone https://github.com/yeheskieltame/Tessera.git\ncd Tessera && go build -o tessera ./cmd/analyst/",
  },
  {
    num: "02",
    title: "Setup AI",
    code: '# Option A: Claude Code Max plan (auto-detected)\n# Option B: Set API key\nexport ANTHROPIC_API_KEY="sk-ant-..."',
  },
  {
    num: "03",
    title: "Start Server",
    code: "./tessera serve",
  },
  {
    num: "04",
    title: "Open Dashboard",
    code: "# Open in your browser\nhttp://localhost:8080",
  },
];

const stats = [
  { value: "19", label: "CLI Commands" },
  { value: "3", label: "Data Sources" },
  { value: "4", label: "QF Mechanisms" },
  { value: "Real-Time", label: "SSE Streaming" },
];

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-32">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img src="/hero-bg.png" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/50 to-white" />
        </div>

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h1 className="text-6xl sm:text-7xl font-black tracking-tight mb-6">
            <span className="text-gradient">Tessera</span>
          </h1>
          <p className="text-xl sm:text-2xl font-semibold text-slate-700 mb-4">
            AI-Powered Public Goods Evaluation for Ethereum
          </p>
          <p className="text-base text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Automate quantitative analysis, trust graph evaluation, and mechanism simulation
            to help evaluators make better funding decisions in the Octant and Gitcoin ecosystems.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/dashboard"
              className="px-8 py-3.5 bg-blue-600 text-white font-semibold rounded-full shadow-lg shadow-blue-300/50 hover:bg-blue-700 hover:shadow-xl transition-all duration-200"
            >
              Launch Dashboard
            </Link>
            <a
              href="https://github.com/yeheskieltame/Tessera"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 glass font-semibold text-slate-700 rounded-full hover:bg-white/80 transition-all duration-200"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <h2 className="text-3xl font-bold text-center text-slate-800 mb-4">
          What It Does
        </h2>
        <p className="text-center text-slate-500 mb-12 max-w-xl mx-auto">
          Four core capabilities to evaluate public goods projects at scale.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <GlassCard key={f.title} hover>
              <div className="mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Setup Guide */}
      <section className="max-w-4xl mx-auto px-6 pb-32">
        <h2 className="text-3xl font-bold text-center text-slate-800 mb-4">
          Get Started
        </h2>
        <p className="text-center text-slate-500 mb-12">
          Four steps from zero to a running dashboard.
        </p>
        <div className="space-y-6">
          {steps.map((s) => (
            <GlassCard key={s.num}>
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {s.num}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-800 mb-3">
                    {s.title}
                  </h3>
                  <CodeBlock code={s.code} />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-6 pb-32">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => (
            <GlassCard key={s.label} className="text-center">
              <p className="text-2xl font-black text-gradient mb-1">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-blue-100/50 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-slate-500">
            Built by{" "}
            <span className="font-semibold text-slate-700">
              Yeheskiel Yunus Rame
            </span>{" "}
            +{" "}
            <span className="font-semibold text-gradient">
              Claude Opus 4.6
            </span>
          </p>
          <p className="text-xs text-slate-400 mt-2">
            The Synthesis Hackathon &middot;{" "}
            <a
              href="https://github.com/yeheskieltame/Tessera"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
