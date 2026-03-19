"use client";

import { useCallback, useEffect, useState } from "react";
import FloatingNav from "@/components/FloatingNav";
import GlassCard from "@/components/GlassCard";
import StatusCard from "@/components/StatusCard";
import DataTable from "@/components/DataTable";
import ProgressStepper from "@/components/ProgressStepper";
import PdfViewer from "@/components/PdfViewer";
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
  type EpochInfo,
  type ProjectScore,
  type TrustNode,
  type MechanismResult,
  type ReportEntry,
  type AnalyzeStep,
} from "@/lib/api";

/* ─── Helpers ─── */
function truncAddr(addr: string) {
  if (addr.length <= 14) return addr;
  return addr.slice(0, 8) + "..." + addr.slice(-6);
}

/* ─── Section wrapper ─── */
function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 mb-20">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/* ─── Input row ─── */
function InputRow({
  label,
  value,
  onChange,
  onSubmit,
  buttonLabel,
  loading,
  placeholder,
  extra,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  buttonLabel: string;
  loading: boolean;
  placeholder?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-6">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          {label}
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 rounded-xl glass-strong text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
      </div>
      {extra}
      <button
        onClick={onSubmit}
        disabled={loading}
        className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200/50 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Loading...
          </span>
        ) : (
          buttonLabel
        )}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  /* ─── Status ─── */
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [epochInfo, setEpochInfo] = useState<EpochInfo | null>(null);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch((e) => setStatusError(e.message));
    getCurrentEpoch()
      .then(setEpochInfo)
      .catch(() => {});
  }, []);

  /* ─── Epoch Analysis ─── */
  const [epochInput, setEpochInput] = useState("5");
  const [epochData, setEpochData] = useState<ProjectScore[]>([]);
  const [epochLoading, setEpochLoading] = useState(false);

  const handleAnalyzeEpoch = useCallback(async () => {
    const n = parseInt(epochInput);
    if (isNaN(n)) return;
    setEpochLoading(true);
    try {
      const data = await analyzeEpoch(n);
      setEpochData(data);
    } catch {
      setEpochData([]);
    } finally {
      setEpochLoading(false);
    }
  }, [epochInput]);

  /* ─── Trust Graph ─── */
  const [trustEpoch, setTrustEpoch] = useState("5");
  const [trustData, setTrustData] = useState<TrustNode[]>([]);
  const [trustLoading, setTrustLoading] = useState(false);

  const handleTrustGraph = useCallback(async () => {
    const n = parseInt(trustEpoch);
    if (isNaN(n)) return;
    setTrustLoading(true);
    try {
      const data = await getTrustGraph(n);
      setTrustData(data);
    } catch {
      setTrustData([]);
    } finally {
      setTrustLoading(false);
    }
  }, [trustEpoch]);

  /* ─── Simulation ─── */
  const [simEpoch, setSimEpoch] = useState("5");
  const [simData, setSimData] = useState<MechanismResult[]>([]);
  const [simLoading, setSimLoading] = useState(false);

  const handleSimulate = useCallback(async () => {
    const n = parseInt(simEpoch);
    if (isNaN(n)) return;
    setSimLoading(true);
    try {
      const data = await getSimulation(n);
      setSimData(data);
    } catch {
      setSimData([]);
    } finally {
      setSimLoading(false);
    }
  }, [simEpoch]);

  /* ─── Analyze Project (SSE) ─── */
  const [projectAddr, setProjectAddr] = useState("");
  const [projectEpoch, setProjectEpoch] = useState("");
  const [projectSteps, setProjectSteps] = useState<AnalyzeStep[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);

  const handleAnalyzeProject = useCallback(() => {
    if (!projectAddr.trim()) return;
    setProjectLoading(true);
    setProjectSteps([]);

    const epoch = parseInt(projectEpoch) || undefined;
    const es = streamAnalyzeProject(projectAddr.trim(), epoch);

    es.onmessage = (event) => {
      try {
        const step = JSON.parse(event.data) as AnalyzeStep;
        setProjectSteps((prev) => {
          const idx = prev.findIndex((s) => s.step === step.step);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = step;
            return next;
          }
          return [...prev, step];
        });
        if (step.status === "done" && step.step === 6) {
          es.close();
          setProjectLoading(false);
        }
        if (step.status === "error") {
          es.close();
          setProjectLoading(false);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      setProjectLoading(false);
    };
  }, [projectAddr, projectEpoch]);

  /* ─── Reports ─── */
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const data = await getReports();
      setReports(data);
    } catch {
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <>
      <FloatingNav />

      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <PdfViewer url={viewingPdf} onClose={() => setViewingPdf(null)} />
      )}

      <main className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        {/* ─── Status ─── */}
        <Section
          id="status"
          title="Status Overview"
          subtitle="Live connection status for all data sources and AI providers."
        >
          {statusError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
              Could not connect to API: {statusError}. Make sure{" "}
              <code className="font-mono text-xs bg-red-100 px-1.5 py-0.5 rounded">
                ./tessera serve
              </code>{" "}
              is running.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatusCard
              title="Octant API"
              value={status?.octant.connected ? "Connected" : "Disconnected"}
              status={status?.octant.connected ? "online" : "offline"}
              subtitle={
                status?.octant.connected
                  ? `Epoch ${status.octant.epoch}`
                  : undefined
              }
            />
            <StatusCard
              title="AI Provider"
              value={status?.ai.provider ?? "Unknown"}
              status={status ? "online" : "neutral"}
              subtitle={status?.ai.model}
            />
            <StatusCard
              title="Current Epoch"
              value={epochInfo ? `Epoch ${epochInfo.epoch}` : "---"}
              status={epochInfo ? "online" : "neutral"}
              subtitle={
                epochInfo
                  ? `${epochInfo.projectCount} projects`
                  : undefined
              }
            />
          </div>
        </Section>

        {/* ─── Epoch Analysis ─── */}
        <Section
          id="analyze"
          title="Epoch Analysis"
          subtitle="K-means clustering, composite scoring, and anomaly detection for any epoch."
        >
          <GlassCard>
            <InputRow
              label="Epoch Number"
              value={epochInput}
              onChange={setEpochInput}
              onSubmit={handleAnalyzeEpoch}
              buttonLabel="Analyze"
              loading={epochLoading}
              placeholder="e.g. 5"
            />
            <DataTable
              columns={[
                { key: "rank", header: "#" },
                {
                  key: "address",
                  header: "Address",
                  render: (r: ProjectScore) => (
                    <span className="font-mono text-xs">{truncAddr(r.address)}</span>
                  ),
                },
                { key: "name", header: "Name" },
                { key: "allocated", header: "Allocated" },
                { key: "matched", header: "Matched" },
                {
                  key: "score",
                  header: "Score",
                  render: (r: ProjectScore) => (
                    <span className="font-bold text-blue-600">
                      {typeof r.score === "number" ? r.score.toFixed(1) : r.score}
                    </span>
                  ),
                },
                {
                  key: "cluster",
                  header: "Cluster",
                  render: (r: ProjectScore) => {
                    const colors = [
                      "bg-blue-100 text-blue-700",
                      "bg-violet-100 text-violet-700",
                      "bg-emerald-100 text-emerald-700",
                      "bg-amber-100 text-amber-700",
                    ];
                    return (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[r.cluster % colors.length]}`}
                      >
                        C{r.cluster}
                      </span>
                    );
                  },
                },
              ]}
              data={epochData}
              emptyMessage="Enter an epoch number and click Analyze to see results."
            />
          </GlassCard>
        </Section>

        {/* ─── Trust Graph ─── */}
        <Section
          id="trust"
          title="Trust Graph"
          subtitle="Sybil detection, whale dependency, and coordination risk analysis."
        >
          <GlassCard>
            <InputRow
              label="Epoch Number"
              value={trustEpoch}
              onChange={setTrustEpoch}
              onSubmit={handleTrustGraph}
              buttonLabel="Build Trust Graph"
              loading={trustLoading}
              placeholder="e.g. 5"
            />
            <DataTable
              columns={[
                {
                  key: "address",
                  header: "Address",
                  render: (r: TrustNode) => (
                    <span className="font-mono text-xs">{truncAddr(r.address)}</span>
                  ),
                },
                { key: "name", header: "Name" },
                { key: "donors", header: "Donors" },
                {
                  key: "diversity",
                  header: "Diversity",
                  render: (r: TrustNode) => (
                    <span>{typeof r.diversity === "number" ? r.diversity.toFixed(3) : r.diversity}</span>
                  ),
                },
                {
                  key: "whaleDependency",
                  header: "Whale Dep.",
                  render: (r: TrustNode) => (
                    <span
                      className={
                        r.whaleDependency > 0.5 ? "text-red-600 font-semibold" : ""
                      }
                    >
                      {typeof r.whaleDependency === "number"
                        ? (r.whaleDependency * 100).toFixed(1) + "%"
                        : r.whaleDependency}
                    </span>
                  ),
                },
                {
                  key: "coordinationRisk",
                  header: "Coord. Risk",
                  render: (r: TrustNode) => (
                    <span
                      className={
                        r.coordinationRisk > 0.5 ? "text-red-600 font-semibold" : ""
                      }
                    >
                      {typeof r.coordinationRisk === "number"
                        ? (r.coordinationRisk * 100).toFixed(1) + "%"
                        : r.coordinationRisk}
                    </span>
                  ),
                },
                {
                  key: "flags",
                  header: "Flags",
                  render: (r: TrustNode) =>
                    r.flags && r.flags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.flags.map((f, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                        Clean
                      </span>
                    ),
                },
              ]}
              data={trustData}
              emptyMessage="Enter an epoch number and click Build Trust Graph to see results."
            />
          </GlassCard>
        </Section>

        {/* ─── Simulation ─── */}
        <Section
          id="simulate"
          title="Mechanism Simulation"
          subtitle="Compare funding mechanisms: Standard QF, Capped, Equal-weight, and Trust-Weighted."
        >
          <GlassCard>
            <InputRow
              label="Epoch Number"
              value={simEpoch}
              onChange={setSimEpoch}
              onSubmit={handleSimulate}
              buttonLabel="Simulate"
              loading={simLoading}
              placeholder="e.g. 5"
            />
            <DataTable
              columns={[
                {
                  key: "name",
                  header: "Mechanism",
                  render: (r: MechanismResult) => (
                    <span className="font-semibold text-slate-800">{r.name}</span>
                  ),
                },
                {
                  key: "gini",
                  header: "Gini Coefficient",
                  render: (r: MechanismResult) => (
                    <span
                      className={
                        r.gini > 0.5 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"
                      }
                    >
                      {typeof r.gini === "number" ? r.gini.toFixed(4) : r.gini}
                    </span>
                  ),
                },
                {
                  key: "topShare",
                  header: "Top 10% Share",
                  render: (r: MechanismResult) => (
                    <span>
                      {typeof r.topShare === "number"
                        ? (r.topShare * 100).toFixed(1) + "%"
                        : r.topShare}
                    </span>
                  ),
                },
                {
                  key: "aboveThreshold",
                  header: "Above Threshold",
                  render: (r: MechanismResult) => (
                    <span className="font-semibold">{r.aboveThreshold}</span>
                  ),
                },
              ]}
              data={simData}
              emptyMessage="Enter an epoch number and click Simulate to compare mechanisms."
            />
          </GlassCard>
        </Section>

        {/* ─── Analyze Project ─── */}
        <Section
          id="project"
          title="Analyze Project"
          subtitle="Full project analysis with SSE streaming: data, trust, simulation, AI scoring, and report generation."
        >
          <GlassCard>
            <InputRow
              label="Project Address"
              value={projectAddr}
              onChange={setProjectAddr}
              onSubmit={handleAnalyzeProject}
              buttonLabel="Full Analysis"
              loading={projectLoading}
              placeholder="0x..."
              extra={
                <div className="min-w-[120px]">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Epoch (optional)
                  </label>
                  <input
                    type="text"
                    value={projectEpoch}
                    onChange={(e) => setProjectEpoch(e.target.value)}
                    placeholder="latest"
                    className="w-full px-4 py-2.5 rounded-xl glass-strong text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                  />
                </div>
              }
            />
            <ProgressStepper steps={projectSteps} />
          </GlassCard>
        </Section>

        {/* ─── Reports ─── */}
        <Section
          id="reports"
          title="PDF Reports"
          subtitle="Generated intelligence reports. View or download directly."
        >
          <GlassCard>
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-slate-500">
                {reports.length} report{reports.length !== 1 ? "s" : ""} found
              </span>
              <button
                onClick={loadReports}
                disabled={reportsLoading}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50"
              >
                {reportsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {reports.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No reports generated yet. Use Analyze Project to create one.
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <div
                    key={r.filename}
                    className="flex items-center justify-between p-4 rounded-xl bg-blue-50/30 hover:bg-blue-50/60 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {r.project || r.filename}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {r.date} &middot;{" "}
                        {r.size ? `${(r.size / 1024).toFixed(0)} KB` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingPdf(getReportUrl(r.filename))}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        View
                      </button>
                      <a
                        href={getReportUrl(r.filename)}
                        download
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </Section>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-blue-100/50 text-center">
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
        </footer>
      </main>
    </>
  );
}
