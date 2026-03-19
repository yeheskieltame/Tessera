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
  type StatusResponse,
  type EpochResponse,
  type AnalyzeEpochResponse,
  type TrustGraphResponse,
  type SimulateResponse,
  type ReportsResponse,
} from "@/lib/api";

function truncAddr(addr: string) {
  if (addr.length <= 14) return addr;
  return addr.slice(0, 8) + "..." + addr.slice(-6);
}

export default function DashboardPage() {
  /* ─── Status ─── */
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [epoch, setEpoch] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStatus(), getCurrentEpoch()])
      .then(([s, e]) => {
        setStatus(s);
        setEpoch(e.currentEpoch);
        setSelectedEpoch(e.currentEpoch > 1 ? 5 : e.currentEpoch);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ─── Epoch Analysis ─── */
  const [selectedEpoch, setSelectedEpoch] = useState(5);
  const [epochData, setEpochData] = useState<AnalyzeEpochResponse | null>(null);
  const [epochLoading, setEpochLoading] = useState(false);

  async function runAnalyze() {
    setEpochLoading(true);
    try {
      const data = await analyzeEpoch(selectedEpoch);
      setEpochData(data);
    } catch {}
    setEpochLoading(false);
  }

  /* ─── Trust Graph ─── */
  const [trustData, setTrustData] = useState<TrustGraphResponse | null>(null);
  const [trustLoading, setTrustLoading] = useState(false);

  async function runTrust() {
    setTrustLoading(true);
    try {
      const data = await getTrustGraph(selectedEpoch);
      setTrustData(data);
    } catch {}
    setTrustLoading(false);
  }

  /* ─── Simulate ─── */
  const [simData, setSimData] = useState<SimulateResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  async function runSimulate() {
    setSimLoading(true);
    try {
      const data = await getSimulation(selectedEpoch);
      setSimData(data);
    } catch {}
    setSimLoading(false);
  }

  /* ─── Reports ─── */
  const [reports, setReports] = useState<ReportsResponse | null>(null);
  const [viewPdf, setViewPdf] = useState<string | null>(null);

  async function loadReports() {
    try {
      const data = await getReports();
      setReports(data);
    } catch {}
  }

  useEffect(() => {
    loadReports();
  }, []);

  const octantService = status?.services?.find((s) => s.name === "Octant API");
  const aiService = status?.services?.find((s) => s.name === "AI Providers");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
      {/* Floating Nav */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-lg shadow-blue-100/50 rounded-full px-2 py-2 flex items-center gap-1">
          <a href="/" className="px-3 py-1.5 text-sm font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent mr-1">
            Tessera
          </a>
          {["status", "analyze", "trust", "simulate", "reports"].map((id) => (
            <a
              key={id}
              href={`#${id}`}
              className="px-3 py-1.5 rounded-full text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 transition-all duration-200 capitalize"
            >
              {id}
            </a>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-24 pb-20 space-y-20">
        {/* ─── Status ─── */}
        <section id="status" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Status Overview</h2>
          <p className="text-sm text-slate-500 mb-6">Live connection status for all data sources and AI providers.</p>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/80 backdrop-blur border border-white/50 rounded-2xl p-5 shadow-lg shadow-blue-100/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${octantService?.status === "ok" ? "bg-green-400" : "bg-red-400"} animate-pulse`} />
                  <span className="text-sm font-medium text-slate-500">Octant API</span>
                </div>
                <p className="text-xl font-bold text-slate-800">
                  {octantService?.status === "ok" ? octantService.detail : "Disconnected"}
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur border border-white/50 rounded-2xl p-5 shadow-lg shadow-blue-100/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${aiService?.status === "ok" ? "bg-green-400" : "bg-yellow-400"} animate-pulse`} />
                  <span className="text-sm font-medium text-slate-500">AI Provider</span>
                </div>
                <p className="text-xl font-bold text-slate-800">
                  {aiService?.status === "ok" ? aiService.detail : "None"}
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur border border-white/50 rounded-2xl p-5 shadow-lg shadow-blue-100/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-sm font-medium text-slate-500">Current Epoch</span>
                </div>
                <p className="text-xl font-bold text-slate-800">{epoch || "---"}</p>
              </div>
            </div>
          )}
        </section>

        {/* ─── Epoch Analysis ─── */}
        <section id="analyze" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Epoch Analysis</h2>
          <p className="text-sm text-slate-500 mb-6">K-means clustering, composite scoring, and ranking.</p>

          <div className="bg-white/80 backdrop-blur border border-white/50 rounded-2xl shadow-lg shadow-blue-100/30 p-6">
            <div className="flex flex-wrap items-end gap-3 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Epoch</label>
                <input
                  type="number"
                  value={selectedEpoch}
                  onChange={(e) => setSelectedEpoch(Number(e.target.value))}
                  className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                onClick={runAnalyze}
                disabled={epochLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl px-6 py-2 transition disabled:opacity-50"
              >
                {epochLoading ? "Analyzing..." : "Analyze"}
              </button>
            </div>

            {epochData && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-xs">
                      <th className="px-3 py-2 text-left">Rank</th>
                      <th className="px-3 py-2 text-left">Address</th>
                      <th className="px-3 py-2 text-right">Allocated</th>
                      <th className="px-3 py-2 text-right">Matched</th>
                      <th className="px-3 py-2 text-right">Score</th>
                      <th className="px-3 py-2 text-center">Cluster</th>
                    </tr>
                  </thead>
                  <tbody>
                    {epochData.projects?.map((p, i) => (
                      <tr key={p.address} className="border-t border-slate-100 hover:bg-blue-50/30">
                        <td className="px-3 py-2 font-medium">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs">{truncAddr(p.address)}</td>
                        <td className="px-3 py-2 text-right">{p.allocated?.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right">{p.matched?.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{p.compositeScore?.toFixed(1)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">{p.cluster}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ─── Trust Graph ─── */}
        <section id="trust" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Trust Graph</h2>
          <p className="text-sm text-slate-500 mb-6">Donor diversity, whale dependency, and coordination risk analysis.</p>

          <div className="bg-white/80 backdrop-blur border border-white/50 rounded-2xl shadow-lg shadow-blue-100/30 p-6">
            <button
              onClick={runTrust}
              disabled={trustLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl px-6 py-2 transition mb-6 disabled:opacity-50"
            >
              {trustLoading ? "Building..." : "Build Trust Graph"}
            </button>

            {trustData && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-xs">
                      <th className="px-3 py-2 text-left">Address</th>
                      <th className="px-3 py-2 text-right">Donors</th>
                      <th className="px-3 py-2 text-right">Diversity</th>
                      <th className="px-3 py-2 text-right">Whale Dep</th>
                      <th className="px-3 py-2 text-right">Coord Risk</th>
                      <th className="px-3 py-2 text-center">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trustData.profiles?.map((p) => (
                      <tr key={p.address} className="border-t border-slate-100 hover:bg-blue-50/30">
                        <td className="px-3 py-2 font-mono text-xs">{truncAddr(p.address)}</td>
                        <td className="px-3 py-2 text-right">{p.uniqueDonors}</td>
                        <td className="px-3 py-2 text-right">{p.donorDiversity?.toFixed(3)}</td>
                        <td className="px-3 py-2 text-right">{(p.whaleDepRatio * 100)?.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right">{p.coordinationRisk?.toFixed(3)}</td>
                        <td className="px-3 py-2 text-center">
                          {p.flags?.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">{p.flags.length}</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">Clean</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ─── Simulate ─── */}
        <section id="simulate" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Mechanism Simulation</h2>
          <p className="text-sm text-slate-500 mb-6">Compare Standard QF, Capped QF, Equal Weight, and Trust-Weighted QF.</p>

          <div className="bg-white/80 backdrop-blur border border-white/50 rounded-2xl shadow-lg shadow-blue-100/30 p-6">
            <button
              onClick={runSimulate}
              disabled={simLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl px-6 py-2 transition mb-6 disabled:opacity-50"
            >
              {simLoading ? "Simulating..." : "Run Simulation"}
            </button>

            {simData && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-xs">
                      <th className="px-3 py-2 text-left">Mechanism</th>
                      <th className="px-3 py-2 text-right">Gini</th>
                      <th className="px-3 py-2 text-right">Top Share</th>
                      <th className="px-3 py-2 text-right">Above Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simData.mechanisms?.map((m) => (
                      <tr key={m.name} className="border-t border-slate-100 hover:bg-blue-50/30">
                        <td className="px-3 py-2 font-medium">{m.name}</td>
                        <td className="px-3 py-2 text-right">{m.giniCoeff?.toFixed(3)}</td>
                        <td className="px-3 py-2 text-right">{(m.topShare * 100)?.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right">{m.aboveThreshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ─── Reports ─── */}
        <section id="reports" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">PDF Reports</h2>
          <p className="text-sm text-slate-500 mb-6">Generated intelligence reports with Tessera Agent watermark.</p>

          <div className="bg-white/80 backdrop-blur border border-white/50 rounded-2xl shadow-lg shadow-blue-100/30 p-6">
            <button
              onClick={loadReports}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl px-6 py-2 transition mb-6"
            >
              Refresh
            </button>

            {reports?.reports?.length ? (
              <div className="space-y-3">
                {reports.reports.map((r) => (
                  <div key={r.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.modTime} — {(r.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewPdf(getReportUrl(r.name))}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                      >
                        View
                      </button>
                      <a
                        href={getReportUrl(r.name)}
                        download
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No reports generated yet. Run analyze-project from CLI to generate PDF reports.</p>
            )}
          </div>
        </section>

        {/* ─── PDF Viewer Modal ─── */}
        {viewPdf && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewPdf(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold text-slate-700">Report Viewer</h3>
                <button onClick={() => setViewPdf(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>
              <iframe src={viewPdf} className="flex-1 w-full" />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-slate-400 border-t border-slate-100">
        Built by Yeheskiel Yunus Rame + Claude Opus 4.6 | The Synthesis Hackathon |{" "}
        <a href="https://github.com/yeheskieltame/Tessera" className="text-blue-500 hover:underline">GitHub</a>
      </footer>
    </div>
  );
}
