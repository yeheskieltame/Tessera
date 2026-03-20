"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getStatus,
  getCurrentEpoch,
  analyzeEpoch,
  getTrustGraph,
  getSimulation,
  getReports,
  getReportUrl,
  getProviders,
  selectProvider,
  streamAnalyzeProject,
  type StatusResponse,
  type AnalyzeEpochResponse,
  type TrustGraphResponse,
  type SimulateResponse,
  type ReportsResponse,
  type ProvidersResponse,
} from "@/lib/api";

const API = "";

/* ─── Helper: truncate address ─── */
function shortAddr(addr: string) {
  if (!addr || addr.length <= 16) return addr;
  return addr.slice(0, 8) + "\u2026" + addr.slice(-6);
}

/* ─── Helper: Copy address button ─── */
function CopyAddr({ addr }: { addr: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      {addr}
      <button
        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(addr); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="text-blue-400 hover:text-blue-600 ml-1 whitespace-nowrap"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </span>
  );
}

/* ─── Reusable ExpandableSection ─── */
function ExpandableSection({ title, children, compact }: { title: string; children: React.ReactNode; compact?: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Compact view inside card + expand trigger */}
      <div className="mt-3">
        {compact || (
          <div className="max-h-48 overflow-hidden relative">
            {children}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/80 to-transparent" />
          </div>
        )}
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/50 rounded-xl px-3 py-2 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
          Expand {title}
        </button>
      </div>

      {/* Full-screen focused modal — portaled to body (same as PDF viewer) */}
      {expanded && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setExpanded(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-800">{title}</h3>
              <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-auto p-6 text-slate-700">
              {children}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default function DashboardPage() {
  /* ─── Status ─── */
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedEpoch, setSelectedEpoch] = useState(5);

  useEffect(() => {
    Promise.all([getStatus(), getCurrentEpoch()])
      .then(([s, e]) => { setStatus(s); setCurrentEpoch(e.currentEpoch); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ─── Epoch Analysis ─── */
  const [epochData, setEpochData] = useState<AnalyzeEpochResponse | null>(null);
  const [epochLoading, setEpochLoading] = useState(false);

  /* ─── Anomaly Detection ─── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [anomalyData, setAnomalyData] = useState<any>(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);

  /* ─── Trust Graph ─── */
  const [trustData, setTrustData] = useState<TrustGraphResponse | null>(null);
  const [trustLoading, setTrustLoading] = useState(false);

  /* ─── Simulate ─── */
  const [simData, setSimData] = useState<SimulateResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  /* ─── Evaluate ─── */
  const [evalName, setEvalName] = useState("");
  const [evalDesc, setEvalDesc] = useState("");
  const [evalGithub, setEvalGithub] = useState("");
  const [evalResult, setEvalResult] = useState<string | null>(null);
  const [evalReportPath, setEvalReportPath] = useState<string | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  /* ─── Analyze Project ─── */
  const [projectAddr, setProjectAddr] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [projectResult, setProjectResult] = useState<any>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectSteps, setProjectSteps] = useState<string[]>([]);

  /* ─── Track Project ─── */
  const [trackAddr, setTrackAddr] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackLoading, setTrackLoading] = useState(false);

  /* ─── Providers ─── */
  const [providersData, setProvidersData] = useState<ProvidersResponse | null>(null);
  const [providerSwitching, setProviderSwitching] = useState(false);

  useEffect(() => { getProviders().then(setProvidersData).catch(() => {}); }, []);

  async function handleSelectProvider(compositeKey: string) {
    const [provName, ...modelParts] = compositeKey.split("|");
    const modelName = modelParts.join("|");
    if (!provName || !modelName) return;
    setProviderSwitching(true);
    try {
      await selectProvider(provName, modelName);
      setProvidersData(await getProviders());
    } catch {}
    setProviderSwitching(false);
  }

  /* ─── Reports ─── */
  const [reports, setReports] = useState<ReportsResponse | null>(null);
  const [viewPdf, setViewPdf] = useState<string | null>(null);

  useEffect(() => { getReports().then(setReports).catch(() => {}); }, []);

  /* ─── API Handlers ─── */
  async function runAnalyze() {
    setEpochLoading(true); setEpochData(null);
    try { setEpochData(await analyzeEpoch(selectedEpoch)); } catch {}
    setEpochLoading(false);
  }

  async function runAnomalies() {
    setAnomalyLoading(true); setAnomalyData(null);
    try {
      const res = await fetch(`${API}/api/detect-anomalies?epoch=${selectedEpoch}`);
      setAnomalyData(await res.json());
    } catch {}
    setAnomalyLoading(false);
  }

  async function runTrust() {
    setTrustLoading(true); setTrustData(null);
    try { setTrustData(await getTrustGraph(selectedEpoch)); } catch {}
    setTrustLoading(false);
  }

  async function runSimulate() {
    setSimLoading(true); setSimData(null);
    try { setSimData(await getSimulation(selectedEpoch)); } catch {}
    setSimLoading(false);
  }

  async function runEvaluate() {
    if (!evalName || !evalDesc) return;
    setEvalLoading(true); setEvalResult(null); setEvalReportPath(null);
    try {
      const res = await fetch(`${API}/api/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: evalName, description: evalDesc, ...(evalGithub && { githubURL: evalGithub }) }),
      });
      const d = await res.json();
      setEvalResult(d.evaluation || d.error || "No result");
      if (d.reportPath) setEvalReportPath(d.reportPath);
    } catch {}
    setEvalLoading(false);
  }

  async function runTrackProject() {
    if (!trackAddr) return;
    setTrackLoading(true); setTrackResult(null);
    try {
      const res = await fetch(`${API}/api/track-project?address=${encodeURIComponent(trackAddr)}`);
      setTrackResult(await res.json());
    } catch {}
    setTrackLoading(false);
  }

  function runAnalyzeProject() {
    if (!projectAddr) return;
    setProjectLoading(true); setProjectResult(null); setProjectSteps([]);
    const es = streamAnalyzeProject(projectAddr, selectedEpoch);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.step === "done") {
          setProjectResult(data.result || data);
          setProjectLoading(false);
          es.close();
        } else {
          setProjectSteps((prev) => [...prev, data.message || `Step ${data.step}`]);
        }
      } catch {}
    };
    es.onerror = () => { setProjectLoading(false); es.close(); };
  }

  /* ─── Helper: select address from table row ─── */
  function selectProjectAddr(addr: string) {
    setProjectAddr(addr);
    document.getElementById("project")?.scrollIntoView({ behavior: "smooth" });
  }

  const octant = status?.services?.find((s) => s.name === "Octant API");
  const ai = status?.services?.find((s) => s.name === "AI Providers");

  return (
    <div className="min-h-screen relative">
      {/* Fixed background image */}
      <div className="fixed inset-0 z-0">
        <img src="/dashboard-bg.png" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-blue-900/10 to-blue-950/20" />
      </div>
      <div className="relative z-10">

      {/* ─── Top Bar (sticky) ─── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-2xl border-b border-slate-200/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold bg-gradient-to-r from-blue-700 to-violet-600 bg-clip-text text-transparent tracking-tight">Tessera</span>
            <span className="text-xs font-medium text-slate-600 border-l border-slate-300 pl-3">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${octant?.status === "ok" ? "bg-green-400" : "bg-red-400"}`} />
                  <span className="text-xs font-medium text-slate-700">Octant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${ai?.status === "ok" ? "bg-green-400" : "bg-red-400"}`} />
                  <span className="text-xs font-medium text-slate-700">AI</span>
                </div>
                <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">Epoch {currentEpoch || "---"}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Epoch Control Bar (sticky) ─── */}
      <div className="sticky top-14 z-40 bg-white/80 backdrop-blur-2xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center gap-4">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Epoch</label>
          <input type="number" value={selectedEpoch} onChange={(e) => setSelectedEpoch(Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-200 bg-white/70 backdrop-blur-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <div className="flex gap-1">
            {[3, 4, 5, 6].map((e) => (
              <button key={e} onClick={() => setSelectedEpoch(e)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${selectedEpoch === e ? "bg-blue-500 text-white shadow-md shadow-blue-500/25" : "bg-white/60 border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600"}`}>
                {e}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">90-day funding cycles. Epoch 5 has the most data.</span>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <main className="max-w-7xl mx-auto px-6 pt-8 pb-20">

        {/* ─── AI Model Selector (inline dropdown, grouped by provider) ─── */}
        {providersData && (() => {
          const activeKey = providersData.preferred && providersData.preferredModel
            ? `${providersData.preferred}|${providersData.preferredModel}`
            : (() => { const first = providersData.providers.find((p) => p.ready && p.default); return first ? `${first.name}|${first.model}` : ""; })();
          const readyModels = providersData.providers.filter((p) => p.ready).length;
          const readyProviders = new Set(providersData.providers.filter((p) => p.ready).map((p) => p.name)).size;
          const totalProviders = new Set(providersData.providers.map((p) => p.name)).size;

          // Group by provider for <optgroup>
          const groups: { name: string; label: string; items: typeof providersData.providers }[] = [];
          const provLabels: Record<string, string> = {
            "claude-cli": "Claude CLI (Max Plan)",
            "claude-api": "Claude API",
            "gemini": "Google Gemini",
            "openai": "OpenAI",
          };
          let currentGroup = "";
          for (const p of providersData.providers) {
            if (p.name !== currentGroup) {
              currentGroup = p.name;
              groups.push({ name: p.name, label: provLabels[p.name] || p.name, items: [] });
            }
            groups[groups.length - 1].items.push(p);
          }

          return (
            <div className="mb-5 flex items-center gap-3 flex-wrap">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">AI Model</label>
              <div className="relative">
                <select
                  value={activeKey}
                  onChange={(e) => handleSelectProvider(e.target.value)}
                  disabled={providerSwitching}
                  className="appearance-none rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-xl pl-3 pr-8 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 cursor-pointer min-w-[300px]"
                >
                  {groups.map((g) => (
                    <optgroup key={g.name} label={`${g.items[0].ready ? "\u2713" : "\u2717"} ${g.label}`}>
                      {g.items.map((p) => (
                        <option key={`${p.name}|${p.model}`} value={`${p.name}|${p.model}`} disabled={!p.ready}>
                          {p.model}{!p.ready ? ` \u2014 ${p.reason || "not configured"}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
              {providerSwitching && <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />}
              <span className="text-xs text-slate-500">{readyProviders}/{totalProviders} providers ready ({readyModels} models)</span>
            </div>
          );
        })()}

        {/* ─── Row 1: Hero Actions (2 columns) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

          {/* Full Project Intelligence — PRIMARY card */}
          <div id="project" className="bg-gradient-to-br from-white/90 via-blue-50/70 to-indigo-100/50 backdrop-blur-2xl rounded-3xl border border-blue-100/60 shadow-lg shadow-blue-500/5 hover:shadow-xl transition-all duration-300 p-6 scroll-mt-32">
            <h3 className="text-base font-bold text-slate-800 mb-1">Full Project Intelligence</h3>
            <p className="text-xs text-slate-500 font-mono mb-4">./tessera analyze-project &lt;address&gt;</p>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Octant Project Address</label>
              <input placeholder="0x02Cb3C150BEdca124d0aE8CcCb72fefbe705c953" value={projectAddr} onChange={(e) => setProjectAddr(e.target.value)}
                className="w-full rounded-lg border border-slate-200/80 bg-white/70 backdrop-blur-xl text-slate-800 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400" />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <span className="text-xs text-slate-500">Quick:</span>
                {[
                  { label: "#1, 7ep, 90% whale", addr: "0x9531C059098e3d194fF87FebB587aB07B30B1306" },
                  { label: "#5, 99% whale", addr: "0x02Cb3C150BEdca124d0aE8CcCb72fefbe705c953" },
                  { label: "#19, diverse", addr: "0x08e40e1C0681D072a54Fc5868752c02bb3996FFA" },
                ].map((ex) => (
                  <button key={ex.addr} onClick={() => setProjectAddr(ex.addr)}
                    className="text-xs px-2 py-0.5 rounded-md bg-white/50 border border-indigo-200/50 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 font-medium transition">
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={runAnalyzeProject} disabled={projectLoading}
              className="bg-indigo-500/80 backdrop-blur-md hover:bg-indigo-600/90 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">$</span>
              <span>{projectLoading ? "Running..." : "tessera analyze-project (streaming)"}</span>
            </button>

            {projectSteps.length > 0 && (
              <div className="mt-3 space-y-1">
                {projectSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs">&#10003;</span>
                    <span className="text-slate-600">{s}</span>
                  </div>
                ))}
                {projectLoading && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                    <span className="text-blue-600">Processing...</span>
                  </div>
                )}
              </div>
            )}

            {projectResult && (
              <div className="mt-4 space-y-3">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/60 backdrop-blur-xl border border-slate-100 rounded-2xl">
                    <p className="text-xs text-slate-500">Rank</p>
                    <p className="text-lg font-bold text-slate-800">{String(projectResult.rank || "?")} / {String(projectResult.totalProjects || "?")}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/60 backdrop-blur-xl border border-slate-100 rounded-2xl">
                    <p className="text-xs text-slate-500">Score</p>
                    <p className="text-lg font-bold text-slate-800">{projectResult.quantitative?.compositeScore != null ? Number(projectResult.quantitative.compositeScore).toFixed(1) : "?"}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/60 backdrop-blur-xl border border-slate-100 rounded-2xl">
                    <p className="text-xs text-slate-500">Donors</p>
                    <p className="text-lg font-bold text-slate-800">{projectResult.trust?.uniqueDonors ?? "?"}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/60 backdrop-blur-xl border border-slate-100 rounded-2xl">
                    <p className="text-xs text-slate-500">Whale Dep</p>
                    <p className="text-lg font-bold text-slate-800">{projectResult.trust?.whaleDepRatio != null ? (Number(projectResult.trust.whaleDepRatio) * 100).toFixed(1) + "%" : "?"}</p>
                  </div>
                </div>

                {/* Multi-Layer Scores */}
                {projectResult.scores && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-700 mb-2">Multi-Layer Scores</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { key: "fundingScore", label: "Funding", weight: "25%" },
                        { key: "efficiencyScore", label: "Efficiency", weight: "25%" },
                        { key: "diversityScore", label: "Diversity", weight: "30%" },
                        { key: "consistencyScore", label: "Consistency", weight: "20%" },
                        { key: "overallScore", label: "Overall", weight: "" },
                      ].map((dim) => {
                        const val = Math.min(100, Math.max(0, Number(projectResult.scores[dim.key] ?? 0)));
                        const isOverall = dim.key === "overallScore";
                        return (
                          <div key={dim.key} className={`p-2 rounded-xl border ${isOverall ? "bg-white/60 backdrop-blur-xl border-slate-100" : "bg-white/60 backdrop-blur-md border-slate-100"}`}>
                            <p className="text-xs text-slate-500">{dim.label}{dim.weight ? ` (${dim.weight})` : ""}</p>
                            <p className={`text-sm font-bold ${isOverall ? "text-blue-600" : "text-slate-800"}`}>{val.toFixed(1)}</p>
                            <div className="w-full h-1 rounded-full bg-white/20 mt-1">
                              <div className={`h-full rounded-full ${isOverall ? "bg-blue-500" : "bg-white/50"}`} style={{width: `${val}%`}} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Temporal Anomalies */}
                {projectResult.anomalies?.length > 0 && (
                  <ExpandableSection title="Temporal Anomalies">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-700 mb-2">Temporal Anomalies ({projectResult.anomalies.length})</h3>
                      <div className="space-y-1.5">
                        {projectResult.anomalies.map((a: {type: string; severity: string; description: string; epoch: number}, i: number) => (
                          <div key={i} className={`p-2 rounded-xl border text-xs ${
                            a.severity === "high" ? "bg-red-500/15 border-red-400/25 text-red-300" :
                            a.severity === "medium" ? "bg-amber-500/15 border-amber-400/25 text-amber-300" :
                            "bg-white/60 backdrop-blur-xl border-slate-100 text-blue-600"
                          }`}>
                            <span className="font-semibold capitalize">{a.type?.replace(/_/g, " ")}</span>
                            <span className="text-xs opacity-70 ml-2">Epoch {a.epoch}</span>
                            <span className={`ml-2 text-xs font-medium uppercase px-1.5 py-0.5 rounded-full ${
                              a.severity === "high" ? "bg-red-100" : a.severity === "medium" ? "bg-yellow-100" : "bg-blue-100"
                            }`}>{a.severity}</span>
                            <p className="text-xs mt-0.5 opacity-80">{a.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ExpandableSection>
                )}

                {/* Mechanism Impact */}
                {projectResult.mechanismImpacts?.length > 0 && (
                  <ExpandableSection title="Mechanism Impact">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-slate-100/60 text-slate-500 uppercase text-xs">
                          <th className="px-2 py-1.5 text-left">Mechanism</th>
                          <th className="px-2 py-1.5 text-right">Allocated</th>
                          <th className="px-2 py-1.5 text-right">Change</th>
                        </tr></thead>
                        <tbody>
                          {projectResult.mechanismImpacts.map((m: {name: string; allocated: number; change: number}) => (
                            <tr key={m.name} className="border-t border-white/10">
                              <td className="px-2 py-1.5">{m.name}</td>
                              <td className="px-2 py-1.5 text-right">{m.allocated.toFixed(4)} ETH</td>
                              <td className="px-2 py-1.5 text-right font-semibold" style={{color: m.change > 0 ? "#16a34a" : "#dc2626"}}>{m.change > 0 ? "+" : ""}{m.change.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ExpandableSection>
                )}

                {projectResult.reportPath && (
                  <div className="flex gap-2">
                    <button onClick={() => { const f = String(projectResult.reportPath).split("/").pop(); setViewPdf(`/api/reports/${f}`); }}
                      className="bg-indigo-500/80 backdrop-blur-md hover:bg-indigo-600/90 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg shadow-indigo-500/25 transition">
                      View PDF Report
                    </button>
                    <a href={`/api/reports/${String(projectResult.reportPath).split("/").pop()}`} download
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg px-4 py-2 transition">
                      Download PDF
                    </a>
                  </div>
                )}

                {projectResult.reportPath && <p className="text-xs text-green-600">PDF report generated. Check Reports section below.</p>}
              </div>
            )}
          </div>

          {/* AI Project Evaluation */}
          <div id="evaluate" className="bg-gradient-to-br from-white/90 via-violet-50/70 to-purple-100/50 backdrop-blur-2xl rounded-3xl border border-violet-100/60 shadow-lg shadow-violet-500/5 hover:shadow-xl transition-all duration-300 p-6 scroll-mt-32">
            <h3 className="text-base font-bold text-slate-800 mb-1">AI Project Evaluation</h3>
            <p className="text-xs text-slate-500 font-mono mb-4">./tessera evaluate &quot;Name&quot; -d &quot;Desc&quot; [-g github-url]</p>

            <div className="mb-3 p-2.5 rounded-lg bg-blue-50/80 backdrop-blur-md border border-blue-200/50 text-xs text-slate-600">
              Enter any public goods project name and description. Optionally add a GitHub URL to enrich the evaluation with README content and repo metrics. The AI evaluates across 8 dimensions: Impact, Team, Innovation, Sustainability, Ecosystem, Transparency, Community, Risk.
            </div>
            <div className="space-y-2.5 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name</label>
                <input placeholder="e.g. Octant, Gitcoin Grants, Protocol Guild" value={evalName} onChange={(e) => setEvalName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200/80 bg-white/70 backdrop-blur-xl text-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Description</label>
                <textarea placeholder="e.g. Octant is a public goods funding platform by Golem Foundation..." value={evalDesc} onChange={(e) => setEvalDesc(e.target.value)} rows={3}
                  className="w-full rounded-lg border border-slate-200/80 bg-white/70 backdrop-blur-xl text-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GitHub URL <span className="font-normal text-slate-400">(optional — enriches with README + repo metrics)</span></label>
                <input placeholder="e.g. https://github.com/golemfoundation/octant" value={evalGithub} onChange={(e) => setEvalGithub(e.target.value)}
                  className="w-full rounded-lg border border-slate-200/80 bg-white/70 backdrop-blur-xl text-slate-800 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400" />
              </div>
            </div>
            <button onClick={runEvaluate} disabled={evalLoading}
              className="bg-violet-500/80 backdrop-blur-md hover:bg-violet-600/90 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg shadow-violet-500/25 transition disabled:opacity-50 flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">$</span>
              <span>{evalLoading ? "Running..." : "tessera evaluate"}</span>
            </button>
            {evalResult && (
              <div className="mt-3 space-y-2">
                <pre className="p-3 rounded-lg bg-white/60 backdrop-blur-xl border border-slate-100 rounded-2xl text-xs whitespace-pre-wrap overflow-x-auto max-h-80">{evalResult}</pre>
                {evalReportPath && (
                  <div className="flex gap-2">
                    <button onClick={() => { const f = String(evalReportPath).split("/").pop(); setViewPdf(`/api/reports/${f}`); }}
                      className="bg-violet-500/80 backdrop-blur-md hover:bg-violet-600/90 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg shadow-violet-500/25 transition">
                      View PDF Report
                    </button>
                    <a href={`/api/reports/${String(evalReportPath).split("/").pop()}`} download
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg px-4 py-2 transition">
                      Download PDF
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Row 2: Quantitative Grid (3 columns) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">

          {/* Epoch Analysis */}
          <div id="analyze" className="bg-gradient-to-br from-white/90 via-teal-50/70 to-cyan-100/50 backdrop-blur-2xl rounded-3xl border border-teal-100/60 shadow-lg shadow-teal-500/5 hover:shadow-xl transition-all duration-300 p-6 scroll-mt-32">
            <h3 className="text-base font-bold text-slate-800 mb-1">Epoch Analysis</h3>
            <p className="text-xs text-slate-500 font-mono mb-4">./tessera analyze-epoch -e {selectedEpoch}</p>
            <button onClick={runAnalyze} disabled={epochLoading}
              className="bg-teal-500/80 backdrop-blur-md hover:bg-teal-600/90 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg shadow-teal-500/25 transition disabled:opacity-50 flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">$</span>
              <span>{epochLoading ? "Running..." : "tessera analyze-epoch"}</span>
            </button>
            {epochData && (
              <ExpandableSection
                title={`Epoch ${selectedEpoch} Analysis - ${epochData.projects?.length ?? 0} Projects`}
                compact={
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-slate-100/60 text-slate-500 uppercase text-xs">
                        <th className="px-2 py-1.5 text-left">#</th>
                        <th className="px-2 py-1.5 text-left">Address</th>
                        <th className="px-2 py-1.5 text-right">Alloc</th>
                        <th className="px-2 py-1.5 text-right">Match</th>
                        <th className="px-2 py-1.5 text-right">Score</th>
                        <th className="px-2 py-1.5 text-center">C</th>
                      </tr></thead>
                      <tbody>
                        {epochData.projects?.slice(0, 5).map((p, i) => (
                          <tr key={p.address} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => selectProjectAddr(p.address)}>
                            <td className="px-2 py-1.5 font-medium">{i + 1}</td>
                            <td className="px-2 py-1.5 font-mono text-xs truncate max-w-[100px]" title={p.address}>{shortAddr(p.address)}</td>
                            <td className="px-2 py-1.5 text-right">{p.allocated?.toFixed(4)}</td>
                            <td className="px-2 py-1.5 text-right">{p.matched?.toFixed(4)}</td>
                            <td className="px-2 py-1.5 text-right font-semibold">{p.compositeScore?.toFixed(1)}</td>
                            <td className="px-2 py-1.5 text-center"><span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs">{p.cluster}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(epochData.projects?.length ?? 0) > 5 && (
                      <p className="text-xs text-slate-500 mt-1 text-center">Showing 5 of {epochData.projects?.length}. Hover to expand.</p>
                    )}
                  </div>
                }
              >
                {/* Expanded: full table with all rows and full addresses */}
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-100/60 text-slate-500 uppercase text-xs">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Address</th>
                    <th className="px-3 py-2 text-right">Allocated (ETH)</th>
                    <th className="px-3 py-2 text-right">Matched (ETH)</th>
                    <th className="px-3 py-2 text-right">Composite Score</th>
                    <th className="px-3 py-2 text-center">Cluster</th>
                  </tr></thead>
                  <tbody>
                    {epochData.projects?.map((p, i) => (
                      <tr key={p.address} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => selectProjectAddr(p.address)}>
                        <td className="px-3 py-2 font-medium">{i + 1}</td>
                        <td className="px-3 py-2"><CopyAddr addr={p.address} /></td>
                        <td className="px-3 py-2 text-right font-mono">{p.allocated?.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right font-mono">{p.matched?.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{p.compositeScore?.toFixed(1)}</td>
                        <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs font-medium">{p.cluster}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-500 mt-3">Click any row to populate the Full Project Intelligence address input.</p>
              </ExpandableSection>
            )}
          </div>

          {/* Anomaly Detection */}
          <div id="anomalies" className="bg-gradient-to-br from-white/90 via-rose-50/70 to-pink-100/50 backdrop-blur-2xl rounded-3xl border border-rose-100/60 shadow-lg shadow-rose-500/5 hover:shadow-xl transition-all duration-300 p-6 scroll-mt-32">
            <h3 className="text-base font-bold text-slate-800 mb-1">Anomaly Detection</h3>
            <p className="text-xs text-slate-500 font-mono mb-4">./tessera detect-anomalies -e {selectedEpoch}</p>
            <button onClick={runAnomalies} disabled={anomalyLoading}
              className="bg-rose-500/80 backdrop-blur-md hover:bg-rose-600/90 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg shadow-rose-500/25 transition disabled:opacity-50 flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">$</span>
              <span>{anomalyLoading ? "Running..." : "tessera detect-anomalies"}</span>
            </button>
            {anomalyData && (
              <ExpandableSection
                title={`Anomaly Detection - Epoch ${selectedEpoch}`}
                compact={
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {Object.entries(anomalyData).filter(([k]) => k !== "flags").slice(0, 4).map(([k, v]) => (
                      <div key={k} className="p-2.5 rounded-xl bg-white/60 backdrop-blur-xl border border-slate-100 rounded-2xl">
                        <p className="text-xs text-slate-500 capitalize">{k.replace(/([A-Z])/g, " $1")}</p>
                        <p className="text-sm font-bold text-slate-800">{typeof v === "number" ? (k.includes("oncentration") ? `${(Number(v) * 100).toFixed(1)}%` : Number(v).toFixed(v > 100 ? 0 : 4)) : String(v)}</p>
                      </div>
                    ))}
                    {Object.entries(anomalyData).filter(([k]) => k !== "flags").length > 4 && (
                      <p className="col-span-full text-xs text-slate-500 text-center">+{Object.entries(anomalyData).filter(([k]) => k !== "flags").length - 4} more stats. Hover to expand.</p>
                    )}
                    {Array.isArray((anomalyData as Record<string, unknown>).flags) && ((anomalyData as Record<string, unknown>).flags as string[]).slice(0, 2).map((f: string, i: number) => (
                      <div key={i} className="col-span-full p-2.5 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">{f}</div>
                    ))}
                  </div>
                }
              >
                {/* Expanded: all stats + all flags */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(anomalyData).filter(([k]) => k !== "flags").map(([k, v]) => (
                    <div key={k} className="p-3 rounded-xl bg-slate-50 border border-slate-100 rounded-2xl">
                      <p className="text-xs text-slate-500 capitalize">{k.replace(/([A-Z])/g, " $1")}</p>
                      <p className="text-base font-bold text-slate-800">{typeof v === "number" ? (k.includes("oncentration") ? `${(Number(v) * 100).toFixed(1)}%` : Number(v).toFixed(v > 100 ? 0 : 4)) : String(v)}</p>
                    </div>
                  ))}
                </div>
                {Array.isArray((anomalyData as Record<string, unknown>).flags) && ((anomalyData as Record<string, unknown>).flags as string[]).length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-semibold text-red-700">Flags</h4>
                    {((anomalyData as Record<string, unknown>).flags as string[]).map((f: string, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{f}</div>
                    ))}
                  </div>
                )}
              </ExpandableSection>
            )}
          </div>

          {/* Trust Graph */}
          <div id="trust" className="bg-gradient-to-br from-white/90 via-sky-50/70 to-blue-100/50 backdrop-blur-2xl rounded-3xl border border-sky-100/60 shadow-lg shadow-sky-500/5 hover:shadow-xl transition-all duration-300 p-6 scroll-mt-32">
            <h3 className="text-base font-bold text-slate-800 mb-1">Trust Graph</h3>
            <p className="text-xs text-slate-500 font-mono mb-4">./tessera trust-graph -e {selectedEpoch}</p>
            <button onClick={runTrust} disabled={trustLoading}
              className="bg-sky-500/80 backdrop-blur-md hover:bg-sky-600/90 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg shadow-sky-500/25 transition disabled:opacity-50 flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">$</span>
              <span>{trustLoading ? "Running..." : "tessera trust-graph"}</span>
            </button>
            {trustData && (
              <ExpandableSection
                title={`Trust Graph - Epoch ${selectedEpoch} - ${trustData.profiles?.length ?? 0} Profiles`}
                compact={
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-slate-100/60 text-slate-500 uppercase text-xs">
                        <th className="px-2 py-1.5 text-left">Address</th>
                        <th className="px-2 py-1.5 text-right">Don</th>
                        <th className="px-2 py-1.5 text-right">Div</th>
                        <th className="px-2 py-1.5 text-right">Whale</th>
                        <th className="px-2 py-1.5 text-right">Coord</th>
                        <th className="px-2 py-1.5 text-center">Flags</th>
                      </tr></thead>
                      <tbody>
                        {trustData.profiles?.slice(0, 5).map((p) => (
                          <tr key={p.address} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => selectProjectAddr(p.address)}>
                            <td className="px-2 py-1.5 font-mono text-xs" title={p.address}>{shortAddr(p.address)}</td>
                            <td className="px-2 py-1.5 text-right">{p.uniqueDonors}</td>
                            <td className="px-2 py-1.5 text-right">{p.donorDiversity?.toFixed(3)}</td>
                            <td className="px-2 py-1.5 text-right">{(p.whaleDepRatio * 100)?.toFixed(1)}%</td>
                            <td className="px-2 py-1.5 text-right">{p.coordinationRisk?.toFixed(3)}</td>
                            <td className="px-2 py-1.5 text-center">
                              {p.flags?.length > 0
                                ? <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs">{p.flags.length}</span>
                                : <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(trustData.profiles?.length ?? 0) > 5 && (
                      <p className="text-xs text-slate-500 mt-1 text-center">Showing 5 of {trustData.profiles?.length}. Hover to expand.</p>
                    )}
                  </div>
                }
              >
                {/* Expanded: full table with all rows and full addresses */}
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-100/60 text-slate-500 uppercase text-xs">
                    <th className="px-3 py-2 text-left">Address</th>
                    <th className="px-3 py-2 text-right">Unique Donors</th>
                    <th className="px-3 py-2 text-right">Diversity</th>
                    <th className="px-3 py-2 text-right">Whale Dep</th>
                    <th className="px-3 py-2 text-right">Coord Risk</th>
                    <th className="px-3 py-2 text-left">Flags</th>
                  </tr></thead>
                  <tbody>
                    {trustData.profiles?.map((p) => (
                      <tr key={p.address} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => selectProjectAddr(p.address)}>
                        <td className="px-3 py-2"><CopyAddr addr={p.address} /></td>
                        <td className="px-3 py-2 text-right">{p.uniqueDonors}</td>
                        <td className="px-3 py-2 text-right font-mono">{p.donorDiversity?.toFixed(3)}</td>
                        <td className="px-3 py-2 text-right font-mono">{(p.whaleDepRatio * 100)?.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right font-mono">{p.coordinationRisk?.toFixed(3)}</td>
                        <td className="px-3 py-2">
                          {p.flags?.length > 0
                            ? <div className="space-y-0.5">{p.flags.map((f, fi) => <span key={fi} className="inline-block mr-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs">{f}</span>)}</div>
                            : <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-500 mt-3">Click any row to populate the Full Project Intelligence address input.</p>
              </ExpandableSection>
            )}
          </div>
        </div>

        {/* ─── Row 3: Advanced Analysis (wider left, narrower right) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">

          {/* Mechanism Simulation — wider */}
          <div id="simulate" className="lg:col-span-3 bg-gradient-to-br from-white/90 via-amber-50/70 to-orange-100/50 backdrop-blur-2xl rounded-3xl border border-amber-100/60 shadow-lg shadow-amber-500/5 hover:shadow-xl transition-all duration-300 p-6 scroll-mt-32">
            <h3 className="text-base font-bold text-slate-800 mb-1">Mechanism Simulation</h3>
            <p className="text-xs text-slate-500 font-mono mb-4">./tessera simulate -e {selectedEpoch}</p>
            <button onClick={runSimulate} disabled={simLoading}
              className="bg-amber-500/80 backdrop-blur-md hover:bg-amber-600/90 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg shadow-amber-500/25 transition disabled:opacity-50 flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">$</span>
              <span>{simLoading ? "Running..." : "tessera simulate"}</span>
            </button>
            {simData && (
              <ExpandableSection title={`Mechanism Simulation - Epoch ${selectedEpoch}`}>
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-100/60 text-slate-500 uppercase text-xs">
                      <th className="px-2 py-1.5 text-left">Mechanism</th>
                      <th className="px-2 py-1.5 text-right">Gini</th>
                      <th className="px-2 py-1.5 text-right">Top Share</th>
                      <th className="px-2 py-1.5 text-right">Above Thr</th>
                      <th className="px-2 py-1.5 text-right">Projects</th>
                    </tr></thead>
                    <tbody>
                      {simData.mechanisms?.map((m) => (
                        <tr key={m.name} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-2 py-1.5 font-medium">{m.name}</td>
                          <td className="px-2 py-1.5 text-right">{m.giniCoeff?.toFixed(3)}</td>
                          <td className="px-2 py-1.5 text-right">{(m.topShare * 100)?.toFixed(1)}%</td>
                          <td className="px-2 py-1.5 text-right">{m.aboveThreshold}</td>
                          <td className="px-2 py-1.5 text-right">{m.projects?.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ExpandableSection>
            )}
          </div>

          {/* Track Project */}
          <div id="track" className="lg:col-span-2 bg-gradient-to-br from-white/90 via-fuchsia-50/70 to-purple-100/50 backdrop-blur-2xl rounded-3xl border border-fuchsia-100/60 shadow-lg shadow-fuchsia-500/5 hover:shadow-xl transition-all duration-300 p-6 scroll-mt-32">
            <h3 className="text-base font-bold text-slate-800 mb-1">Track Project</h3>
            <p className="text-xs text-slate-500 font-mono mb-4">./tessera track-project &lt;address&gt;</p>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project Address</label>
              <input placeholder="0x02Cb3C150BEdca124d0aE8CcCb72fefbe705c953" value={trackAddr} onChange={(e) => setTrackAddr(e.target.value)}
                className="w-full rounded-lg border border-slate-200/80 bg-white/70 backdrop-blur-xl text-slate-800 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-400" />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <span className="text-xs text-slate-500">Quick:</span>
                {[
                  { label: "#1, 7ep, 90% whale", addr: "0x9531C059098e3d194fF87FebB587aB07B30B1306" },
                  { label: "#5, 99% whale", addr: "0x02Cb3C150BEdca124d0aE8CcCb72fefbe705c953" },
                  { label: "#19, diverse", addr: "0x08e40e1C0681D072a54Fc5868752c02bb3996FFA" },
                ].map((ex) => (
                  <button key={ex.addr} onClick={() => setTrackAddr(ex.addr)}
                    className="text-xs px-2 py-0.5 rounded-md bg-white/50 border border-fuchsia-200/50 text-fuchsia-600 hover:bg-fuchsia-50 hover:text-fuchsia-700 font-medium transition">
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={runTrackProject} disabled={trackLoading}
              className="bg-fuchsia-500/80 backdrop-blur-md hover:bg-fuchsia-600/90 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg shadow-fuchsia-500/25 transition disabled:opacity-50 flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">$</span>
              <span>{trackLoading ? "Running..." : "tessera track-project"}</span>
            </button>

            {trackResult && (
              <div className="mt-3 space-y-4">
                {/* Timeline Table */}
                {trackResult.timeline?.length > 0 && (
                  <ExpandableSection title="Cross-Epoch Timeline">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-700 mb-2">Cross-Epoch Timeline</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-slate-100/60 text-slate-500 uppercase text-xs">
                            <th className="px-2 py-1.5 text-left">Epoch</th>
                            <th className="px-2 py-1.5 text-right">Alloc (ETH)</th>
                            <th className="px-2 py-1.5 text-right">Match (ETH)</th>
                            <th className="px-2 py-1.5 text-right">Donors</th>
                          </tr></thead>
                          <tbody>
                            {trackResult.timeline.map((t: {epoch: number; allocated: number; matched: number; donors: number}) => (
                              <tr key={t.epoch} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-2 py-1.5 font-medium">Epoch {t.epoch}</td>
                                <td className="px-2 py-1.5 text-right">{t.allocated?.toFixed(4)}</td>
                                <td className="px-2 py-1.5 text-right">{t.matched?.toFixed(4)}</td>
                                <td className="px-2 py-1.5 text-right">{t.donors}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </ExpandableSection>
                )}

                {/* Temporal Anomalies */}
                {trackResult.anomalies?.length > 0 && (
                  <ExpandableSection title={`Temporal Anomalies (${trackResult.anomalies.length})`}>
                    <div>
                      <h3 className="text-xs font-semibold text-slate-700 mb-2">Temporal Anomalies</h3>
                      <div className="space-y-1.5">
                        {trackResult.anomalies.map((a: {type: string; severity: string; epoch: number; description: string}, i: number) => (
                          <div key={i} className={`p-2.5 rounded-xl border text-xs ${
                            a.severity === "high" ? "bg-red-500/15 border-red-400/25 text-red-300" :
                            a.severity === "medium" ? "bg-amber-500/15 border-amber-400/25 text-amber-300" :
                            "bg-white/60 backdrop-blur-xl border-slate-100 text-blue-600"
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                a.severity === "high" ? "bg-red-500" :
                                a.severity === "medium" ? "bg-yellow-500" :
                                "bg-blue-500"
                              }`} />
                              <span className="font-semibold capitalize">{a.type?.replace(/_/g, " ")}</span>
                              <span className="text-xs opacity-70">Epoch {a.epoch}</span>
                              <span className={`ml-auto text-xs font-medium uppercase px-1.5 py-0.5 rounded-full ${
                                a.severity === "high" ? "bg-red-100 text-red-600" :
                                a.severity === "medium" ? "bg-yellow-100 text-yellow-600" :
                                "bg-blue-100 text-blue-600"
                              }`}>{a.severity}</span>
                            </div>
                            <p className="mt-0.5 text-xs opacity-80">{a.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ExpandableSection>
                )}

                {/* Multi-Layer Scores */}
                {trackResult.scores && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-700 mb-2">Multi-Layer Scores</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { key: "fundingScore", label: "Funding", weight: "25%" },
                        { key: "efficiencyScore", label: "Efficiency", weight: "25%" },
                        { key: "diversityScore", label: "Diversity", weight: "30%" },
                        { key: "consistencyScore", label: "Consistency", weight: "20%" },
                        { key: "overallScore", label: "Overall", weight: "" },
                      ].map((dim) => {
                        const val = trackResult.scores[dim.key] ?? 0;
                        const pct = Math.min(100, Math.max(0, Number(val)));
                        const isOverall = dim.key === "overallScore";
                        return (
                          <div key={dim.key} className={`p-2.5 rounded-xl border ${isOverall ? "bg-white/60 backdrop-blur-xl border-slate-100 col-span-2 sm:col-span-1" : "bg-white/60 backdrop-blur-md border-slate-100"}`}>
                            <p className="text-xs text-slate-500">{dim.label}{dim.weight ? ` (${dim.weight})` : ""}</p>
                            <p className={`text-sm font-bold ${isOverall ? "text-blue-600" : "text-slate-800"}`}>{pct.toFixed(1)}</p>
                            <div className="w-full h-1 rounded-full bg-white/20 mt-1">
                              <div className={`h-full rounded-full ${isOverall ? "bg-blue-500" : "bg-white/50"}`} style={{width: `${pct}%`}} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No data fallback */}
                {!trackResult.timeline?.length && !trackResult.anomalies?.length && !trackResult.scores && (
                  <div className="p-3 rounded-xl bg-white/60 backdrop-blur-xl border border-slate-100 rounded-2xl text-xs text-slate-500">
                    {trackResult.error ? trackResult.error : "No tracking data available for this address."}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Row 4: PDF Reports (full width) ─── */}
        <div id="reports" className="bg-gradient-to-br from-white/90 via-slate-50/70 to-blue-50/50 backdrop-blur-2xl rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-500/5 hover:shadow-xl transition-all duration-300 p-6 scroll-mt-32">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 mb-1">PDF Reports</h3>
              <p className="text-xs text-slate-500 font-mono">Generated intelligence reports</p>
            </div>
            <button onClick={() => getReports().then(setReports).catch(() => {})}
              className="bg-slate-500/80 backdrop-blur-md hover:bg-slate-600/90 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg shadow-slate-500/25 transition flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">$</span>
              <span>Refresh</span>
            </button>
          </div>
          {reports?.reports?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {reports.reports.map((r) => (
                <div key={r.name} className="flex items-center justify-between p-3 rounded-xl bg-white/60 backdrop-blur-xl border border-slate-100 rounded-2xl">
                  <div className="min-w-0 mr-3">
                    <p className="text-xs font-medium text-slate-700 font-mono truncate">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.modTime} -- {(r.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {r.name.endsWith(".pdf") && (
                      <button onClick={() => setViewPdf(getReportUrl(r.name))}
                        className="text-xs px-2.5 py-1 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 transition">View</button>
                    )}
                    <a href={getReportUrl(r.name)} download className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition">Download</a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No reports yet. Run analyze-project to generate PDF reports.</p>
          )}
        </div>

      </main>

      {/* ─── PDF Viewer Modal ─── */}
      {viewPdf && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewPdf(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-600">Report Viewer</h3>
              <button onClick={() => setViewPdf(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <iframe src={viewPdf} className="flex-1 w-full rounded-b-2xl" />
          </div>
        </div>
      )}

      <footer className="text-center py-8 text-xs text-slate-500 border-t border-slate-200/50">
        Built by Yeheskiel Yunus Rame + Claude Opus 4.6 | The Synthesis Hackathon |{" "}
        <a href="https://github.com/yeheskieltame/Tessera" className="text-blue-500 hover:underline">GitHub</a>
      </footer>
      </div>{/* close z-10 wrapper */}
    </div>
  );
}
