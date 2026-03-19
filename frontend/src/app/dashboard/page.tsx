"use client";

import { useEffect, useState } from "react";
import {
  getStatus,
  getCurrentEpoch,
  analyzeEpoch,
  getTrustGraph,
  getSimulation,
  getReports,
  getReportUrl,
  streamAnalyzeProject,
  type StatusResponse,
  type AnalyzeEpochResponse,
  type TrustGraphResponse,
  type SimulateResponse,
  type ReportsResponse,
} from "@/lib/api";

const API = "";

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
  const [anomalyData, setAnomalyData] = useState<Record<string, unknown> | null>(null);
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
  const [evalResult, setEvalResult] = useState<string | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  /* ─── Analyze Project ─── */
  const [projectAddr, setProjectAddr] = useState("");
  const [projectResult, setProjectResult] = useState<Record<string, unknown> | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectSteps, setProjectSteps] = useState<string[]>([]);

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
    setEvalLoading(true); setEvalResult(null);
    try {
      const res = await fetch(`${API}/api/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: evalName, description: evalDesc }),
      });
      const data = await res.json();
      setEvalResult(data.evaluation || data.error || "No result");
    } catch {}
    setEvalLoading(false);
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

  const octant = status?.services?.find((s) => s.name === "Octant API");
  const ai = status?.services?.find((s) => s.name === "AI Providers");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      {/* Floating Nav */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-lg shadow-blue-100/50 rounded-full px-3 py-2 flex items-center gap-1 flex-wrap">
          <a href="/" className="px-3 py-1.5 text-sm font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">Tessera</a>
          {["status","analyze","anomalies","trust","simulate","evaluate","project","reports"].map((id) => (
            <a key={id} href={`#${id}`} className="px-2.5 py-1.5 rounded-full text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 transition capitalize">{id}</a>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-20 space-y-16">

        {/* ─── STATUS ─── */}
        <section id="status" className="scroll-mt-24">
          <SectionHeader title="Status Overview" subtitle="./tessera status — Live connection status" />
          {loading ? <Spinner /> : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatusCard label="Octant API" value={octant?.status === "ok" ? octant.detail : "Disconnected"} ok={octant?.status === "ok"} />
              <StatusCard label="AI Provider" value={ai?.status === "ok" ? ai.detail : "None"} ok={ai?.status === "ok"} />
              <StatusCard label="Current Epoch" value={currentEpoch ? String(currentEpoch) : "---"} ok={true} />
            </div>
          )}
        </section>

        {/* ─── EPOCH INPUT ─── */}
        <div className="flex items-end gap-3 p-4 bg-white/60 backdrop-blur border border-white/40 rounded-2xl shadow-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Epoch</label>
            <input type="number" value={selectedEpoch} onChange={(e) => setSelectedEpoch(Number(e.target.value))}
              className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <p className="text-xs text-slate-400 pb-2">Select epoch for all analysis commands below</p>
        </div>

        {/* ─── ANALYZE EPOCH ─── */}
        <section id="analyze" className="scroll-mt-24">
          <SectionHeader title="Epoch Analysis" subtitle="./tessera analyze-epoch -e N — K-means clustering + composite scoring" />
          <Card>
            <CmdButton onClick={runAnalyze} loading={epochLoading} label="analyze-epoch" />
            {epochData && (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-slate-500 uppercase text-xs">
                    <th className="px-3 py-2 text-left">Rank</th>
                    <th className="px-3 py-2 text-left">Address</th>
                    <th className="px-3 py-2 text-right">Allocated (ETH)</th>
                    <th className="px-3 py-2 text-right">Matched (ETH)</th>
                    <th className="px-3 py-2 text-right">Score</th>
                    <th className="px-3 py-2 text-center">Cluster</th>
                  </tr></thead>
                  <tbody>
                    {epochData.projects?.map((p, i) => (
                      <tr key={p.address} className="border-t border-slate-100 hover:bg-blue-50/30">
                        <td className="px-3 py-2 font-medium">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs">{p.address}</td>
                        <td className="px-3 py-2 text-right">{p.allocated?.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right">{p.matched?.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{p.compositeScore?.toFixed(1)}</td>
                        <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">{p.cluster}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

        {/* ─── ANOMALY DETECTION ─── */}
        <section id="anomalies" className="scroll-mt-24">
          <SectionHeader title="Anomaly Detection" subtitle="./tessera detect-anomalies -e N — Whale concentration + coordinated patterns" />
          <Card>
            <CmdButton onClick={runAnomalies} loading={anomalyLoading} label="detect-anomalies" />
            {anomalyData && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(anomalyData).filter(([k]) => k !== "flags").map(([k, v]) => (
                  <div key={k} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-500 capitalize">{k.replace(/([A-Z])/g, " $1")}</p>
                    <p className="text-lg font-bold text-slate-800">{typeof v === "number" ? (k.includes("oncentration") ? `${(Number(v) * 100).toFixed(1)}%` : Number(v).toFixed(v > 100 ? 0 : 4)) : String(v)}</p>
                  </div>
                ))}
                {Array.isArray((anomalyData as Record<string, unknown>).flags) && ((anomalyData as Record<string, unknown>).flags as string[]).map((f: string, i: number) => (
                  <div key={i} className="col-span-full p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{f}</div>
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* ─── TRUST GRAPH ─── */}
        <section id="trust" className="scroll-mt-24">
          <SectionHeader title="Trust Graph" subtitle="./tessera trust-graph -e N — Donor diversity, whale dependency, Jaccard similarity" />
          <Card>
            <CmdButton onClick={runTrust} loading={trustLoading} label="trust-graph" />
            {trustData && (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-slate-500 uppercase text-xs">
                    <th className="px-3 py-2 text-left">Address</th>
                    <th className="px-3 py-2 text-right">Donors</th>
                    <th className="px-3 py-2 text-right">Diversity</th>
                    <th className="px-3 py-2 text-right">Whale Dep</th>
                    <th className="px-3 py-2 text-right">Coord Risk</th>
                    <th className="px-3 py-2 text-center">Flags</th>
                  </tr></thead>
                  <tbody>
                    {trustData.profiles?.map((p) => (
                      <tr key={p.address} className="border-t border-slate-100 hover:bg-blue-50/30">
                        <td className="px-3 py-2 font-mono text-xs">{p.address}</td>
                        <td className="px-3 py-2 text-right">{p.uniqueDonors}</td>
                        <td className="px-3 py-2 text-right">{p.donorDiversity?.toFixed(3)}</td>
                        <td className="px-3 py-2 text-right">{(p.whaleDepRatio * 100)?.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right">{p.coordinationRisk?.toFixed(3)}</td>
                        <td className="px-3 py-2 text-center">
                          {p.flags?.length > 0
                            ? <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">{p.flags.length} flags</span>
                            : <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">Clean</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

        {/* ─── SIMULATE ─── */}
        <section id="simulate" className="scroll-mt-24">
          <SectionHeader title="Mechanism Simulation" subtitle="./tessera simulate -e N — Standard QF, Capped QF, Equal Weight, Trust-Weighted QF" />
          <Card>
            <CmdButton onClick={runSimulate} loading={simLoading} label="simulate" />
            {simData && (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-slate-500 uppercase text-xs">
                    <th className="px-3 py-2 text-left">Mechanism</th>
                    <th className="px-3 py-2 text-right">Gini</th>
                    <th className="px-3 py-2 text-right">Top Share</th>
                    <th className="px-3 py-2 text-right">Above Threshold</th>
                    <th className="px-3 py-2 text-right">Projects</th>
                  </tr></thead>
                  <tbody>
                    {simData.mechanisms?.map((m) => (
                      <tr key={m.name} className="border-t border-slate-100 hover:bg-blue-50/30">
                        <td className="px-3 py-2 font-medium">{m.name}</td>
                        <td className="px-3 py-2 text-right">{m.giniCoeff?.toFixed(3)}</td>
                        <td className="px-3 py-2 text-right">{(m.topShare * 100)?.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right">{m.aboveThreshold}</td>
                        <td className="px-3 py-2 text-right">{m.projects?.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

        {/* ─── EVALUATE ─── */}
        <section id="evaluate" className="scroll-mt-24">
          <SectionHeader title="AI Project Evaluation" subtitle='./tessera evaluate "Name" -d "Description" — 8-dimension LLM evaluation via Claude Opus 4.6' />
          <Card>
            <div className="space-y-3 mb-4">
              <input placeholder="Project name" value={evalName} onChange={(e) => setEvalName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <textarea placeholder="Project description" value={evalDesc} onChange={(e) => setEvalDesc(e.target.value)} rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <CmdButton onClick={runEvaluate} loading={evalLoading} label="evaluate" />
            {evalResult && <pre className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs whitespace-pre-wrap overflow-x-auto max-h-96">{evalResult}</pre>}
          </Card>
        </section>

        {/* ─── ANALYZE PROJECT ─── */}
        <section id="project" className="scroll-mt-24">
          <SectionHeader title="Full Project Intelligence" subtitle="./tessera analyze-project <address> — One command, complete report (SSE streaming)" />
          <Card>
            <div className="flex flex-wrap gap-3 mb-4">
              <input placeholder="0x... project address" value={projectAddr} onChange={(e) => setProjectAddr(e.target.value)}
                className="flex-1 min-w-[300px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <CmdButton onClick={runAnalyzeProject} loading={projectLoading} label="analyze-project (streaming)" />
            {projectSteps.length > 0 && (
              <div className="mt-4 space-y-1">
                {projectSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs">&#10003;</span>
                    <span className="text-slate-600">{s}</span>
                  </div>
                ))}
                {projectLoading && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                    <span className="text-blue-600">Processing...</span>
                  </div>
                )}
              </div>
            )}
            {projectResult && <pre className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs whitespace-pre-wrap overflow-x-auto max-h-96">{JSON.stringify(projectResult, null, 2)}</pre>}
          </Card>
        </section>

        {/* ─── REPORTS ─── */}
        <section id="reports" className="scroll-mt-24">
          <SectionHeader title="PDF Reports" subtitle="Generated intelligence reports with Tessera Agent watermark" />
          <Card>
            <CmdButton onClick={() => getReports().then(setReports).catch(() => {})} loading={false} label="Refresh reports" />
            {reports?.reports?.length ? (
              <div className="space-y-3 mt-4">
                {reports.reports.map((r) => (
                  <div key={r.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-slate-700 font-mono">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.modTime} — {(r.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="flex gap-2">
                      {r.name.endsWith(".pdf") && (
                        <button onClick={() => setViewPdf(getReportUrl(r.name))}
                          className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition">View PDF</button>
                      )}
                      <a href={getReportUrl(r.name)} download className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition">Download</a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 mt-4">No reports yet. Run analyze-project from CLI to generate PDF reports.</p>
            )}
          </Card>
        </section>

        {/* ─── PDF Viewer Modal ─── */}
        {viewPdf && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewPdf(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold text-slate-700">Report Viewer</h3>
                <button onClick={() => setViewPdf(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
              </div>
              <iframe src={viewPdf} className="flex-1 w-full rounded-b-2xl" />
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-slate-400 border-t border-slate-100">
        Built by Yeheskiel Yunus Rame + Claude Opus 4.6 | The Synthesis Hackathon |{" "}
        <a href="https://github.com/yeheskieltame/Tessera" className="text-blue-500 hover:underline">GitHub</a>
      </footer>
    </div>
  );
}

/* ─── Shared Components ─── */

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
      <p className="text-sm text-slate-500 mt-1 font-mono">{subtitle}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/80 backdrop-blur border border-white/50 rounded-2xl shadow-lg shadow-blue-100/30 p-6">
      {children}
    </div>
  );
}

function CmdButton({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl px-5 py-2.5 transition disabled:opacity-50 flex items-center gap-2">
      <span className="font-mono text-xs opacity-70">$</span>
      <span>{loading ? "Running..." : `tessera ${label}`}</span>
    </button>
  );
}

function StatusCard({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="bg-white/80 backdrop-blur border border-white/50 rounded-2xl p-5 shadow-lg shadow-blue-100/30">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full ${ok ? "bg-green-400" : "bg-red-400"} animate-pulse`} />
        <span className="text-sm font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}
