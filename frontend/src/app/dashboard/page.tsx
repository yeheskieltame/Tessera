"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getStatus,
  getCurrentEpoch,
  getReports,
  getReportUrl,
  getProviders,
  selectProvider,
  streamAnalyzeProject,
  streamEvaluateProject,
  analyzeEpoch,
  getTrustGraph,
  getSimulation,
  detectBridge,
  connectBridgeToServer,
  disconnectBridge,
  type StatusResponse,
  type ReportsResponse,
  type ProvidersResponse,
  type AnalyzeEpochResponse,
  type TrustGraphResponse,
  type SimulateResponse,
  type BridgeStatus,
} from "@/lib/api";

const API = "";

/* ─── Step definitions for the 11-step pipeline ─── */
const PIPELINE_STEPS = [
  { num: 1, label: "Funding History", icon: "H", color: "blue" },
  { num: 2, label: "Quantitative Scoring", icon: "Q", color: "teal" },
  { num: 3, label: "Trust Graph", icon: "T", color: "sky" },
  { num: 4, label: "Mechanism Simulation", icon: "M", color: "amber" },
  { num: 5, label: "Temporal Anomalies", icon: "A", color: "rose" },
  { num: 6, label: "Multi-Layer Scoring", icon: "S", color: "violet" },
  { num: 7, label: "Blockchain Scan", icon: "B", color: "emerald" },
  { num: 8, label: "OSO Signals", icon: "O", color: "cyan" },
  { num: 9, label: "AI Evaluation", icon: "AI", color: "indigo" },
  { num: 10, label: "Adaptive Collection", icon: "AC", color: "orange" },
  { num: 11, label: "Signal Reliability", icon: "SR", color: "lime" },
];

/* ─── Step definitions for the 5-step evaluate pipeline ─── */
const EVAL_PIPELINE_STEPS = [
  { num: 1, label: "Input Validation", icon: "V", color: "blue" },
  { num: 2, label: "GitHub Signals", icon: "G", color: "teal" },
  { num: 3, label: "AI Evaluation (8 Dim)", icon: "AI", color: "violet" },
  { num: 4, label: "Signal Reliability", icon: "SR", color: "lime" },
  { num: 5, label: "PDF Generation", icon: "P", color: "indigo" },
];

/* ─── Types ─── */
interface StepState {
  status: "pending" | "running" | "done" | "error";
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

/* ─── Expandable Section (full-screen portal modal) ─── */
function ExpandableSection({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen || false);
  const [fullscreen, setFullscreen] = useState(false);

  const content = (
    <div className={`mt-2 rounded-xl border border-slate-200/60 overflow-hidden transition-all duration-300 ${expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
      <div className="p-4 bg-white/40">
        {children}
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/50 border border-slate-200/50 hover:bg-white/70 transition-colors group"
      >
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <div className="flex items-center gap-2">
          {expanded && (
            <span
              onClick={(e) => { e.stopPropagation(); setFullscreen(true); }}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Full screen
            </span>
          )}
          <svg className={`w-4 h-4 text-slate-800 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {content}

      {/* Full-screen modal */}
      {fullscreen && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setFullscreen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-800">{title}</h3>
              <button onClick={() => setFullscreen(false)} className="text-slate-800 hover:text-slate-800 text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-auto p-6 text-slate-700">{children}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ─── Step Progress Item ─── */
function StepItem({ step, state, isLast }: { step: typeof PIPELINE_STEPS[0]; state: StepState; isLast: boolean }) {
  const statusIcon = {
    pending: <div className="w-7 h-7 rounded-full border-2 border-slate-200 bg-white flex items-center justify-center text-xs font-bold text-slate-500">{step.num}</div>,
    running: <div className="w-7 h-7 rounded-full border-2 border-blue-400 border-t-transparent bg-white animate-spin" />,
    done: <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>,
    error: <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">!</div>,
  };

  return (
    <div className="flex gap-3">
      {/* Vertical line + icon */}
      <div className="flex flex-col items-center">
        {statusIcon[state.status]}
        {!isLast && (
          <div className={`w-0.5 flex-1 my-1 ${state.status === "done" ? "bg-green-300" : "bg-slate-200"}`} />
        )}
      </div>
      {/* Content */}
      <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${state.status === "done" ? "text-slate-800" : state.status === "running" ? "text-blue-600" : "text-slate-800"}`}>
            {step.label}
          </span>
          {state.status === "running" && (
            <span className="text-xs text-blue-500 animate-pulse">Running...</span>
          )}
        </div>
        {state.message && state.status !== "pending" && (
          <p className={`text-xs mt-0.5 ${state.status === "done" ? "text-slate-700" : state.status === "running" ? "text-blue-500" : "text-red-500"}`}>
            {state.message}
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  /* ─── Status ─── */
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStatus(), getCurrentEpoch()])
      .then(([s, e]) => { setStatus(s); setCurrentEpoch(e.currentEpoch); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ─── Providers ─── */
  const [providersData, setProvidersData] = useState<ProvidersResponse | null>(null);
  const [providerSwitching, setProviderSwitching] = useState(false);
  useEffect(() => { getProviders().then(setProvidersData).catch(() => {}); }, []);

  async function handleSelectProvider(compositeKey: string) {
    const [provName, ...modelParts] = compositeKey.split("|");
    const modelName = modelParts.join("|");
    if (!provName || !modelName) return;
    setProviderSwitching(true);
    try { await selectProvider(provName, modelName); setProvidersData(await getProviders()); } catch {}
    setProviderSwitching(false);
  }

  /* ─── Local Claude Bridge ─── */
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [bridgeConnecting, setBridgeConnecting] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState("http://localhost:9877");
  const [showBridgeModal, setShowBridgeModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  useEffect(() => {
    detectBridge().then((s) => {
      if (s) {
        setBridgeStatus(s);
        connectBridgeToServer("http://localhost:9877")
          .then(() => getProviders().then(setProvidersData).catch(() => {}))
          .catch(() => {});
      }
    });
  }, []);

  async function handleConnectBridge() {
    setBridgeConnecting(true);
    try {
      const s = await detectBridge(bridgeUrl);
      if (s) {
        setBridgeStatus(s);
        await connectBridgeToServer(bridgeUrl);
        setProvidersData(await getProviders());
        setShowBridgeModal(false);
      } else {
        alert("Could not detect tessera-bridge at " + bridgeUrl + ". Make sure it is running.");
      }
    } catch { alert("Failed to connect bridge."); }
    setBridgeConnecting(false);
  }

  async function handleDisconnectBridge() {
    try {
      await disconnectBridge();
      setBridgeStatus(null);
      setProvidersData(await getProviders());
    } catch {}
  }

  /* ─── Epoch Tools (quick actions) ─── */
  const [selectedEpoch, setSelectedEpoch] = useState(5);
  const [epochData, setEpochData] = useState<AnalyzeEpochResponse | null>(null);
  const [epochLoading, setEpochLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [anomalyData, setAnomalyData] = useState<any>(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [trustData, setTrustData] = useState<TrustGraphResponse | null>(null);
  const [trustLoading, setTrustLoading] = useState(false);
  const [simData, setSimData] = useState<SimulateResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [activeEpochTool, setActiveEpochTool] = useState<string | null>(null);

  async function runEpochTool(tool: string) {
    setActiveEpochTool(tool);
    switch (tool) {
      case "analyze": {
        setEpochLoading(true); setEpochData(null);
        try { setEpochData(await analyzeEpoch(selectedEpoch)); } catch {}
        setEpochLoading(false);
        break;
      }
      case "anomalies": {
        setAnomalyLoading(true); setAnomalyData(null);
        try {
          const res = await fetch(`${API}/api/detect-anomalies?epoch=${selectedEpoch}`);
          setAnomalyData(await res.json());
        } catch {}
        setAnomalyLoading(false);
        break;
      }
      case "trust": {
        setTrustLoading(true); setTrustData(null);
        try { setTrustData(await getTrustGraph(selectedEpoch)); } catch {}
        setTrustLoading(false);
        break;
      }
      case "simulate": {
        setSimLoading(true); setSimData(null);
        try { setSimData(await getSimulation(selectedEpoch)); } catch {}
        setSimLoading(false);
        break;
      }
    }
  }

  function selectProjectFromTable(addr: string) {
    setProjectAddr(addr);
    setActiveEpochTool(null);
  }

  /* ─── Analyze Project (Full Intelligence) ─── */
  const [projectAddr, setProjectAddr] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [projectResult, setProjectResult] = useState<any>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<StepState[]>(
    PIPELINE_STEPS.map(() => ({ status: "pending", message: "" }))
  );
  const [currentStep, setCurrentStep] = useState(0);

  function runAnalyzeProject() {
    if (!projectAddr) return;
    setProjectLoading(true);
    setProjectResult(null);
    setCurrentStep(0);
    setPipelineSteps(PIPELINE_STEPS.map(() => ({ status: "pending", message: "" })));

    const es = streamAnalyzeProject(projectAddr);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.step === "done") {
          // Pipeline finished — set result, mark all remaining as done
          setProjectResult(msg.result || msg);
          setProjectLoading(false);
          setPipelineSteps(prev => prev.map(s =>
            s.status === "pending" || s.status === "running" ? { ...s, status: "done" } : s
          ));
          es.close();
          getReports().then(setReports).catch(() => {});
          return;
        }

        if (msg.step === "error") {
          setProjectLoading(false);
          setPipelineSteps(prev => prev.map(s =>
            s.status === "running" ? { ...s, status: "error", message: msg.error || "Error" } : s
          ));
          es.close();
          return;
        }

        // Progress step: msg.step = number, msg.total = number, msg.message = string, msg.data = optional
        const stepNum = Number(msg.step);
        const hasData = !!msg.data;
        if (!stepNum || stepNum < 1) return;

        setCurrentStep(stepNum);
        setPipelineSteps(prev => prev.map((s, i) => {
          const idx = i + 1; // 1-based step number
          if (idx < stepNum) {
            // Previous steps are done
            return s.status === "done" ? s : { ...s, status: "done" };
          }
          if (idx === stepNum) {
            // Current step: if data is provided, this step is complete; otherwise it just started
            if (hasData) {
              return { status: "done", message: msg.message || s.message, data: msg.data };
            }
            return { status: "running", message: msg.message || "", data: s.data };
          }
          // Future steps stay pending
          return s;
        }));
      } catch {}
    };
    es.onerror = () => {
      setProjectLoading(false);
      setPipelineSteps(prev => prev.map(s =>
        s.status === "running" ? { ...s, status: "error", message: "Connection lost" } : s
      ));
      es.close();
    };
  }

  /* ─── Evaluate Project (AI Qualitative) with Streaming ─── */
  const [evalName, setEvalName] = useState("");
  const [evalDesc, setEvalDesc] = useState("");
  const [evalGithub, setEvalGithub] = useState("");
  const [evalResult, setEvalResult] = useState<string | null>(null);
  const [evalReportPath, setEvalReportPath] = useState<string | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalSteps, setEvalSteps] = useState<StepState[]>(
    EVAL_PIPELINE_STEPS.map(() => ({ status: "pending", message: "" }))
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [evalFullResult, setEvalFullResult] = useState<any>(null);

  function runEvaluate() {
    if (!evalName || !evalDesc) return;
    setEvalLoading(true);
    setEvalResult(null);
    setEvalReportPath(null);
    setEvalFullResult(null);
    setEvalSteps(EVAL_PIPELINE_STEPS.map(() => ({ status: "pending", message: "" })));

    const es = streamEvaluateProject(evalName, evalDesc, evalGithub || undefined);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.step === "done") {
          setEvalFullResult(msg.result || msg);
          setEvalResult(msg.result?.evaluation || null);
          if (msg.result?.reportPath) setEvalReportPath(msg.result.reportPath);
          setEvalLoading(false);
          setEvalSteps(prev => prev.map(s =>
            s.status === "pending" || s.status === "running" ? { ...s, status: "done" } : s
          ));
          es.close();
          getReports().then(setReports).catch(() => {});
          return;
        }

        if (msg.step === "error") {
          setEvalLoading(false);
          setEvalSteps(prev => prev.map(s =>
            s.status === "running" ? { ...s, status: "error", message: msg.error || "Error" } : s
          ));
          es.close();
          return;
        }

        const stepNum = Number(msg.step);
        const hasData = !!msg.data;
        if (!stepNum || stepNum < 1) return;

        setEvalSteps(prev => prev.map((s, i) => {
          const idx = i + 1;
          if (idx < stepNum) return s.status === "done" ? s : { ...s, status: "done" };
          if (idx === stepNum) {
            if (hasData) return { status: "done", message: msg.message || s.message, data: msg.data };
            return { status: "running", message: msg.message || "", data: s.data };
          }
          return s;
        }));
      } catch {}
    };
    es.onerror = () => {
      setEvalLoading(false);
      setEvalSteps(prev => prev.map(s =>
        s.status === "running" ? { ...s, status: "error", message: "Connection lost" } : s
      ));
      es.close();
    };
  }

  /* ─── Reports ─── */
  const [reports, setReports] = useState<ReportsResponse | null>(null);
  const [viewPdf, setViewPdf] = useState<string | null>(null);
  useEffect(() => { getReports().then(setReports).catch(() => {}); }, []);

  const octant = status?.services?.find((s) => s.name === "Octant API");
  const ai = status?.services?.find((s) => s.name === "AI Providers");
  const blockchain = status?.services?.find((s) => s.name === "Blockchain RPC");

  const completedSteps = pipelineSteps.filter(s => s.status === "done").length;
  const pipelineActive = projectLoading || completedSteps > 0;

  return (
    <div className="min-h-screen relative">
      {/* Fixed background */}
      <div className="fixed inset-0 z-0">
        <img src="/dashboard-bg.png" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-blue-900/10 to-blue-950/20" />
      </div>
      <div className="relative z-10">

      {/* ─── Top Bar ─── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-2xl border-b border-slate-200/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2">
              <img src="/tessera-icon-64.png" alt="Tessera" className="w-7 h-7" />
              <span className="text-lg font-bold bg-gradient-to-r from-blue-700 to-violet-600 bg-clip-text text-transparent tracking-tight">Tessera</span>
            </a>
            <span className="text-xs font-medium text-slate-800 border-l border-slate-300 pl-3 hidden sm:inline">Dashboard</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {loading ? (
              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            ) : (
              <>
                {[
                  { svc: octant, label: "Octant" },
                  { svc: blockchain, label: "Chains" },
                  { svc: ai, label: "AI" },
                ].map(({ svc, label }) => (
                  <div key={label} className="flex items-center gap-1.5 hidden sm:flex">
                    <span className={`w-2 h-2 rounded-full ${svc?.status === "ok" ? "bg-green-400" : "bg-red-400"}`} />
                    <span className="text-xs font-medium text-slate-700">{label}</span>
                    {svc?.detail && <span className="text-xs text-slate-800 hidden sm:inline">({svc.detail})</span>}
                  </div>
                ))}
                <span className="text-xs font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">Epoch {currentEpoch || "---"}</span>
              </>
            )}
            <a href="/" className="ml-1 sm:ml-2 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-100 transition">
              Home
            </a>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-8 pb-20">

        {/* AI Model Selector */}
        {providersData && (() => {
          const activeKey = providersData.preferred && providersData.preferredModel
            ? `${providersData.preferred}|${providersData.preferredModel}`
            : (() => { const first = providersData.providers.find((p) => p.ready && p.default); return first ? `${first.name}|${first.model}` : ""; })();
          const groups: { name: string; label: string; icon: string; items: typeof providersData.providers }[] = [];
          const provMeta: Record<string, { label: string; icon: string }> = {
            "claude-local": { label: "Claude Local (Your CLI)", icon: "CL" },
            "claude-cli":   { label: "Claude CLI (Max Plan)", icon: "CC" },
            "claude-api":   { label: "Claude API", icon: "CA" },
            "gemini":       { label: "Google Gemini", icon: "G" },
            "openai":       { label: "OpenAI", icon: "O" },
          };
          let currentGroup = "";
          for (const p of providersData.providers) {
            if (p.name !== currentGroup) {
              currentGroup = p.name;
              const meta = provMeta[p.name] || { label: p.name, icon: "?" };
              groups.push({ name: p.name, label: meta.label, icon: meta.icon, items: [] });
            }
            groups[groups.length - 1].items.push(p);
          }
          const activeProvider = providersData.providers.find(p => `${p.name}|${p.model}` === activeKey);
          const activeLabel = activeProvider ? `${(provMeta[activeProvider.name]?.label || activeProvider.name)} — ${activeProvider.model}` : "Select model";

          return (
            <div className="mb-6 bg-white/70 backdrop-blur-2xl rounded-2xl border border-slate-200/60 shadow-sm p-3 sm:p-4 relative z-30">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">AI Model</label>
                  <div className="relative flex-1 sm:max-w-[400px]">
                    <button onClick={() => setShowModelDropdown(!showModelDropdown)} disabled={providerSwitching}
                      className="w-full flex items-center justify-between rounded-xl border border-slate-200/80 bg-white pl-3 pr-3 py-2.5 text-xs font-semibold text-slate-800 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 cursor-pointer transition">
                      <span className="truncate">{activeLabel}</span>
                      <div className="flex items-center gap-2 ml-2">
                        {providerSwitching && <div className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />}
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${showModelDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </button>

                    {showModelDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowModelDropdown(false)} />
                        <div className="absolute z-[100] top-full left-0 mt-1 w-full sm:w-[420px] bg-white rounded-xl border border-slate-200 shadow-2xl max-h-[320px] overflow-y-auto">
                          {groups.map((g) => (
                            <div key={g.name}>
                              <div className="sticky top-0 bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold ${g.items[0].ready ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-400"}`}>{g.icon}</span>
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{g.label}</span>
                                <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full ${g.items[0].ready ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-400"}`}>
                                  {g.items[0].ready ? "Available" : "Unavailable"}
                                </span>
                              </div>
                              {g.items.map((p) => {
                                const key = `${p.name}|${p.model}`;
                                const isActive = key === activeKey;
                                return (
                                  <button key={key} disabled={!p.ready}
                                    onClick={() => { handleSelectProvider(key); setShowModelDropdown(false); }}
                                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2 text-xs transition
                                      ${isActive ? "bg-blue-50 border-l-2 border-blue-500" : "border-l-2 border-transparent hover:bg-slate-50"}
                                      ${!p.ready ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                                    <span className={`font-semibold flex-1 ${isActive ? "text-blue-700" : "text-slate-700"}`}>{p.model}</span>
                                    {!p.ready && <span className="text-[10px] text-slate-400 truncate max-w-[180px]">{p.reason || "not configured"}</span>}
                                    {isActive && <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {bridgeStatus ? (
                    <>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-2 rounded-lg">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Local Claude Connected
                      </span>
                      <button onClick={handleDisconnectBridge} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-2 rounded-lg hover:bg-red-50 transition">
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setShowBridgeModal(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      Connect Local Claude
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Bridge Connection Modal */}
        {showBridgeModal && createPortal(
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowBridgeModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 pb-0">
                <h3 className="text-lg font-bold text-slate-800">Connect Local Claude CLI</h3>
                <button onClick={() => setShowBridgeModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5 pt-2">
                <p className="text-sm text-slate-500 mb-5">Use your own Claude Code installation for AI analysis. No API key needed.</p>

                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Step 1: Run in your terminal</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-slate-900 text-green-400 px-3 py-2.5 rounded-lg text-sm font-mono select-all">npx tessera-bridge</code>
                    <button onClick={() => {
                      navigator.clipboard.writeText("npx tessera-bridge");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                      className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all min-w-[70px] ${copied ? "bg-green-500 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-600"}`}>
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Requires Claude Code installed: npm i -g @anthropic-ai/claude-code</p>
                </div>

                <div className="mb-5">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Step 2: Connect</p>
                  <div className="flex gap-2">
                    <input type="text" value={bridgeUrl} onChange={(e) => setBridgeUrl(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="http://localhost:9877" />
                    <button onClick={handleConnectBridge} disabled={bridgeConnecting}
                      className="px-5 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition min-w-[110px]">
                      {bridgeConnecting ? "Connecting..." : "Connect"}
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-400">Your prompts are sent directly from this browser to your local machine. Nothing passes through our server.</p>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ═══════ EPOCH TOOLS BAR ═══════ */}
        <div className="mb-6 bg-white/70 backdrop-blur-2xl rounded-2xl border border-slate-200/60 shadow-sm p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Epoch</label>
              <input type="number" value={selectedEpoch} onChange={(e) => setSelectedEpoch(Number(e.target.value))}
                className="w-16 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <div className="flex gap-1">
                {[3, 4, 5, 6].map((e) => (
                  <button key={e} onClick={() => setSelectedEpoch(e)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${selectedEpoch === e ? "bg-blue-500 text-white shadow-sm" : "bg-slate-100 text-slate-800 hover:bg-blue-50 hover:text-blue-600"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex gap-2 flex-wrap">
              {[
                { id: "analyze", label: "List Projects", icon: "table", loading: epochLoading, color: "teal" },
                { id: "anomalies", label: "Anomalies", icon: "alert", loading: anomalyLoading, color: "rose" },
                { id: "trust", label: "Trust Graph", icon: "graph", loading: trustLoading, color: "sky" },
                { id: "simulate", label: "Simulate QF", icon: "sim", loading: simLoading, color: "amber" },
              ].map((tool) => (
                <button key={tool.id} onClick={() => runEpochTool(tool.id)} disabled={tool.loading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                    activeEpochTool === tool.id
                      ? `bg-${tool.color}-500 text-white shadow-md`
                      : `bg-white border border-slate-200 text-slate-700 hover:border-${tool.color}-300 hover:text-${tool.color}-600`
                  }`}>
                  {tool.loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  <span>{tool.label}</span>
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-800 font-medium hidden md:inline">Click a project address to use it in analyze-project</span>
          </div>

          {/* ─── Epoch Tool Results ─── */}

          {/* Epoch Analysis (project list) */}
          {epochData && activeEpochTool === "analyze" && (
            <div className="mt-4">
              <ExpandableSection title={`Epoch ${epochData.epoch} — ${epochData.projects?.length ?? 0} Projects (click to select)`} defaultOpen>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100 text-slate-700 uppercase text-xs">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Address</th>
                      <th className="px-3 py-2 text-right">Allocated (ETH)</th>
                      <th className="px-3 py-2 text-right">Matched (ETH)</th>
                      <th className="px-3 py-2 text-right">Score</th>
                      <th className="px-3 py-2 text-center">Cluster</th>
                    </tr></thead>
                    <tbody>
                      {epochData.projects?.map((p, i) => (
                        <tr key={p.address} className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => selectProjectFromTable(p.address)}>
                          <td className="px-3 py-2 font-medium text-slate-700">{i + 1}</td>
                          <td className="px-3 py-2 font-mono text-xs text-blue-600 hover:text-blue-800">{p.address}</td>
                          <td className="px-3 py-2 text-right font-mono">{p.allocated?.toFixed(4)}</td>
                          <td className="px-3 py-2 text-right font-mono">{p.matched?.toFixed(4)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{p.compositeScore?.toFixed(1)}</td>
                          <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs font-medium">{p.cluster}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ExpandableSection>
            </div>
          )}

          {/* Anomaly Detection */}
          {anomalyData && activeEpochTool === "anomalies" && (
            <div className="mt-4">
              <ExpandableSection title={`Anomaly Detection — Epoch ${selectedEpoch}`} defaultOpen>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                  {Object.entries(anomalyData).filter(([k]) => k !== "flags").map(([k, v]) => (
                    <div key={k} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-700 capitalize">{k.replace(/([A-Z])/g, " $1")}</p>
                      <p className="text-base font-bold text-slate-800">{typeof v === "number" ? (k.includes("oncentration") ? `${(Number(v) * 100).toFixed(1)}%` : Number(v).toFixed(v as number > 100 ? 0 : 4)) : String(v)}</p>
                    </div>
                  ))}
                </div>
                {Array.isArray((anomalyData as Record<string, unknown>).flags) && ((anomalyData as Record<string, unknown>).flags as string[]).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-red-700">Flags</h4>
                    {((anomalyData as Record<string, unknown>).flags as string[]).map((f: string, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{f}</div>
                    ))}
                  </div>
                )}
              </ExpandableSection>
            </div>
          )}

          {/* Trust Graph */}
          {trustData && activeEpochTool === "trust" && (
            <div className="mt-4">
              <ExpandableSection title={`Trust Graph — Epoch ${trustData.epoch} — ${trustData.profiles?.length ?? 0} Projects (click to select)`} defaultOpen>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100 text-slate-700 uppercase text-xs">
                      <th className="px-3 py-2 text-left">Address</th>
                      <th className="px-3 py-2 text-right">Donors</th>
                      <th className="px-3 py-2 text-right">Diversity</th>
                      <th className="px-3 py-2 text-right">Whale Dep</th>
                      <th className="px-3 py-2 text-right">Coord Risk</th>
                      <th className="px-3 py-2 text-left">Flags</th>
                    </tr></thead>
                    <tbody>
                      {trustData.profiles?.map((p) => (
                        <tr key={p.address} className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => selectProjectFromTable(p.address)}>
                          <td className="px-3 py-2 font-mono text-xs text-blue-600 hover:text-blue-800">{p.address}</td>
                          <td className="px-3 py-2 text-right">{p.uniqueDonors}</td>
                          <td className="px-3 py-2 text-right font-mono">{p.donorDiversity?.toFixed(3)}</td>
                          <td className="px-3 py-2 text-right font-mono">{(p.whaleDepRatio * 100)?.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right font-mono">{p.coordinationRisk?.toFixed(3)}</td>
                          <td className="px-3 py-2">
                            {p.flags?.length > 0
                              ? p.flags.map((f, fi) => <span key={fi} className="inline-block mr-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-xs">{f}</span>)
                              : <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 text-xs">OK</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ExpandableSection>
            </div>
          )}

          {/* Mechanism Simulation */}
          {simData && activeEpochTool === "simulate" && (
            <div className="mt-4">
              <ExpandableSection title={`Mechanism Simulation — Epoch ${simData.epoch} — ${simData.mechanisms?.length} Mechanisms`} defaultOpen>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100 text-slate-700 uppercase text-xs">
                      <th className="px-3 py-2 text-left">Mechanism</th>
                      <th className="px-3 py-2 text-right">Gini</th>
                      <th className="px-3 py-2 text-right">Top Share</th>
                      <th className="px-3 py-2 text-right">Above Threshold</th>
                      <th className="px-3 py-2 text-right">Projects</th>
                    </tr></thead>
                    <tbody>
                      {simData.mechanisms?.map((m) => (
                        <tr key={m.name} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium">{m.name}</td>
                          <td className="px-3 py-2 text-right font-mono">{m.giniCoeff?.toFixed(3)}</td>
                          <td className="px-3 py-2 text-right">{(m.topShare * 100)?.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right">{m.aboveThreshold}</td>
                          <td className="px-3 py-2 text-right">{m.projects?.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ExpandableSection>
            </div>
          )}
        </div>

        {/* ═══════ TWO MAIN CARDS ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ───── CARD 1: Full Project Intelligence ───── */}
          <div className="bg-gradient-to-br from-white/90 via-blue-50/70 to-indigo-100/50 backdrop-blur-2xl rounded-3xl border border-blue-100/60 shadow-lg shadow-blue-500/5 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-1">
              <img src="/tessera-icon-64.png" alt="" className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-800">Full Project Intelligence</h3>
            </div>
            <p className="text-xs text-slate-700 font-mono mb-4 ml-9">./tessera analyze-project &lt;address&gt;</p>

            <div className="mb-3 p-2.5 rounded-lg bg-blue-50/80 border border-blue-200/50 text-xs text-slate-800 leading-relaxed">
              11-step pipeline: funding history, quantitative scoring, trust graph, mechanism simulation, temporal anomalies, multi-layer scoring, multi-chain blockchain scan (9 chains), OSO/GitHub signals, AI deep evaluation, adaptive signal collection (Discourse + RetroPGF), and signal reliability assessment. Generates branded PDF report.
            </div>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Octant Project Address</label>
              <input placeholder="0x02Cb3C150BEdca124d0aE8CcCb72fefbe705c953" value={projectAddr} onChange={(e) => setProjectAddr(e.target.value)}
                className="w-full rounded-lg border border-slate-200/80 bg-white/70 text-slate-800 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-700" />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <span className="text-xs text-slate-700">Quick:</span>
                {[
                  { label: "#1, 7ep, 90% whale", addr: "0x9531C059098e3d194fF87FebB587aB07B30B1306" },
                  { label: "#5, 99% whale", addr: "0x02Cb3C150BEdca124d0aE8CcCb72fefbe705c953" },
                  { label: "#19, diverse", addr: "0x08e40e1C0681D072a54Fc5868752c02bb3996FFA" },
                ].map((ex) => (
                  <button key={ex.addr} onClick={() => setProjectAddr(ex.addr)}
                    className="text-xs px-2 py-0.5 rounded-md bg-white/50 border border-indigo-200/50 text-indigo-600 hover:bg-indigo-50 font-medium transition">
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={runAnalyzeProject} disabled={projectLoading}
              className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg px-5 py-2.5 shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">$</span>
              <span>{projectLoading ? `Running step ${currentStep}/9...` : "tessera analyze-project"}</span>
            </button>

            {/* ─── 11-Step Pipeline Progress ─── */}
            {pipelineActive && (
              <div className="mt-5 p-4 rounded-2xl bg-white/60 border border-slate-200/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Pipeline Progress</h4>
                  <span className="text-xs font-semibold text-slate-700">{completedSteps}/{PIPELINE_STEPS.length} steps</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-slate-200 mb-4">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
                    style={{ width: `${(completedSteps / PIPELINE_STEPS.length) * 100}%` }}
                  />
                </div>
                {/* Steps timeline */}
                <div>
                  {PIPELINE_STEPS.map((step, i) => (
                    <StepItem key={step.num} step={step} state={pipelineSteps[i]} isLast={i === PIPELINE_STEPS.length - 1} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ───── CARD 2: AI Project Evaluation ───── */}
          <div className="bg-gradient-to-br from-white/90 via-violet-50/70 to-purple-100/50 backdrop-blur-2xl rounded-3xl border border-violet-100/60 shadow-lg shadow-violet-500/5 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-1">
              <img src="/tessera-icon-64.png" alt="" className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-800">AI Project Evaluation</h3>
            </div>
            <p className="text-xs text-slate-700 font-mono mb-4 ml-9">./tessera evaluate &quot;Name&quot; -d &quot;Desc&quot; [-g github-url]</p>

            <div className="mb-3 p-2.5 rounded-lg bg-violet-50/80 border border-violet-200/50 text-xs text-slate-800 leading-relaxed">
              Evaluate any public goods project across 8 dimensions: Impact, Team, Innovation, Sustainability, Ecosystem, Transparency, Community, Risk. Add GitHub URL for README + repo metrics enrichment. Generates PDF report.
            </div>

            <div className="space-y-2.5 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name</label>
                <input placeholder="e.g. Octant, Gitcoin Grants, Protocol Guild" value={evalName} onChange={(e) => setEvalName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200/80 bg-white/70 text-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-700" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Description</label>
                <textarea placeholder="e.g. Octant is a public goods funding platform by Golem Foundation..." value={evalDesc} onChange={(e) => setEvalDesc(e.target.value)} rows={3}
                  className="w-full rounded-lg border border-slate-200/80 bg-white/70 text-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-700" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GitHub URL <span className="font-normal text-slate-800">(optional)</span></label>
                <input placeholder="e.g. https://github.com/golemfoundation/octant" value={evalGithub} onChange={(e) => setEvalGithub(e.target.value)}
                  className="w-full rounded-lg border border-slate-200/80 bg-white/70 text-slate-800 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-700" />
              </div>
            </div>

            <button onClick={runEvaluate} disabled={evalLoading}
              className="bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg px-5 py-2.5 shadow-lg shadow-violet-500/25 transition disabled:opacity-50 flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">$</span>
              <span>{evalLoading ? "Running evaluation..." : "tessera evaluate"}</span>
            </button>

            {/* ─── Evaluate Pipeline Progress ─── */}
            {(evalLoading || evalSteps.some(s => s.status !== "pending")) && (
              <div className="mt-4 p-3 rounded-xl bg-white/60 border border-violet-200/50">
                <div className="space-y-0">
                  {EVAL_PIPELINE_STEPS.map((step, i) => (
                    <StepItem key={step.num} step={step} state={evalSteps[i]} isLast={i === EVAL_PIPELINE_STEPS.length - 1} />
                  ))}
                </div>
              </div>
            )}

            {evalResult && (
              <div className="mt-4 space-y-3">
                <ExpandableSection title="AI Evaluation Result (8 Dimensions)" defaultOpen>
                  <pre className="text-xs whitespace-pre-wrap text-slate-700 leading-relaxed">{evalResult}</pre>
                </ExpandableSection>
                {evalFullResult?.reliability && (
                  <ExpandableSection title="Signal Reliability">
                    <div className="text-xs text-slate-700 space-y-1">
                      <p><span className="font-semibold">Reliability Score:</span> {Number(evalFullResult.reliability.overallScore).toFixed(0)}/100</p>
                      <p><span className="font-semibold">Data Completeness:</span> {Number(evalFullResult.reliability.dataCompleteness).toFixed(0)}%</p>
                      <p><span className="font-semibold">Signals:</span> {evalFullResult.reliability.highCount} HIGH | {evalFullResult.reliability.mediumCount} MEDIUM | {evalFullResult.reliability.lowCount} LOW</p>
                    </div>
                  </ExpandableSection>
                )}
                {evalReportPath && (
                  <div className="flex gap-2">
                    <button onClick={() => { const f = String(evalReportPath).split("/").pop(); setViewPdf(`/api/reports/${f}`); }}
                      className="bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium rounded-lg px-4 py-2 shadow-lg shadow-violet-500/25 transition">
                      View PDF Report
                    </button>
                    <a href={`/api/reports/${String(evalReportPath).split("/").pop()}`} download
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg px-4 py-2 transition">
                      Download PDF
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══════ RESULTS (Full-Width, after pipeline completes) ═══════ */}
        {projectResult && (
          <div className="mt-6 bg-white/80 backdrop-blur-2xl rounded-3xl border border-slate-200/60 shadow-lg p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Analysis Complete</h3>
                <p className="text-xs text-slate-700">All 11 pipeline steps finished. Expand each section to explore the data.</p>
              </div>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
              {[
                { label: "Rank", value: `${projectResult.rank || "?"} / ${projectResult.totalProjects || "?"}`, color: "text-slate-800" },
                { label: "Composite Score", value: projectResult.quantitative?.compositeScore != null ? Number(projectResult.quantitative.compositeScore).toFixed(1) : "?", color: "text-slate-800" },
                { label: "Overall Score", value: projectResult.scores?.overallScore != null ? Number(projectResult.scores.overallScore).toFixed(1) : "?", color: "text-blue-600" },
                { label: "Donors", value: String(projectResult.trust?.uniqueDonors ?? "?"), color: "text-slate-800" },
                { label: "Whale Dependency", value: projectResult.trust?.whaleDepRatio != null ? (Number(projectResult.trust.whaleDepRatio) * 100).toFixed(1) + "%" : "?", color: "text-slate-800" },
                { label: "Chains Active", value: projectResult.blockchain ? `${projectResult.blockchain.totalChainsActive}/${projectResult.blockchain.chains?.length}` : "?", color: "text-emerald-600" },
              ].map((card) => (
                <div key={card.label} className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/50">
                  <p className="text-xs text-slate-700 mb-0.5">{card.label}</p>
                  <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Expandable Result Sections */}
            <div className="space-y-2">

              {/* Multi-Layer Scores */}
              {projectResult.scores && (
                <ExpandableSection title="Multi-Layer Scores (5 Dimensions)" defaultOpen>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { key: "fundingScore", label: "Funding", weight: "25%", desc: "Total funding normalized" },
                      { key: "efficiencyScore", label: "Efficiency", weight: "25%", desc: "Matched / Allocated ratio" },
                      { key: "diversityScore", label: "Diversity", weight: "30%", desc: "Shannon entropy of donors" },
                      { key: "consistencyScore", label: "Consistency", weight: "20%", desc: "Cross-epoch stability" },
                      { key: "overallScore", label: "Overall", weight: "", desc: "Weighted aggregate" },
                    ].map((dim) => {
                      const val = Math.min(100, Math.max(0, Number(projectResult.scores[dim.key] ?? 0)));
                      const isOverall = dim.key === "overallScore";
                      return (
                        <div key={dim.key} className={`p-3 rounded-xl border ${isOverall ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"}`}>
                          <p className="text-xs font-semibold text-slate-700">{dim.label}{dim.weight ? ` (${dim.weight})` : ""}</p>
                          <p className={`text-2xl font-bold mt-1 ${isOverall ? "text-blue-600" : "text-slate-800"}`}>{val.toFixed(1)}</p>
                          <div className="w-full h-1.5 rounded-full bg-slate-200 mt-2">
                            <div className={`h-full rounded-full transition-all duration-500 ${isOverall ? "bg-blue-500" : val > 50 ? "bg-green-500" : val > 25 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${val}%` }} />
                          </div>
                          <p className="text-xs text-slate-800 mt-1">{dim.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </ExpandableSection>
              )}

              {/* Blockchain Activity */}
              {projectResult.blockchain && (
                <ExpandableSection title={`Multi-Chain Blockchain Activity (${projectResult.blockchain.totalChainsActive} chains active)`}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Total Txs", value: String(projectResult.blockchain.totalTxCount) },
                      { label: "Multi-chain", value: projectResult.blockchain.isMultichain ? "Yes" : "No" },
                      { label: "Has Contracts", value: projectResult.blockchain.hasContracts ? "Yes" : "No" },
                      { label: "Has Stablecoins", value: projectResult.blockchain.hasStablecoins ? "Yes" : "No" },
                    ].map((s) => (
                      <div key={s.label} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-xs text-slate-700">{s.label}</p>
                        <p className="text-sm font-bold text-slate-800">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {projectResult.blockchain.totalTokens && Object.keys(projectResult.blockchain.totalTokens).length > 0 && (
                    <div className="p-3 rounded-xl bg-green-50 border border-green-200 mb-4">
                      <p className="text-xs font-semibold text-green-800 mb-1">Stablecoin Holdings (Cross-Chain Total)</p>
                      <div className="flex gap-4">
                        {Object.entries(projectResult.blockchain.totalTokens as Record<string, number>).map(([sym, total]) => (
                          <span key={sym} className="text-lg font-bold text-green-700">{sym}: ${total.toFixed(2)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-slate-100 text-slate-700 uppercase text-xs">
                        <th className="px-3 py-2 text-left">Chain</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                        <th className="px-3 py-2 text-right">Transactions</th>
                        <th className="px-3 py-2 text-center">Type</th>
                        <th className="px-3 py-2 text-right">Token Balances</th>
                      </tr></thead>
                      <tbody>
                        {projectResult.blockchain.chains?.map((c: { chain: string; balance: number; nativeToken: string; txCount: number; isContract: boolean; contractVerified: boolean; tokenBalances?: { symbol: string; balance: number }[]; error?: string; isTestnet?: boolean }) => (
                          <tr key={c.chain} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium">{c.chain}{c.isTestnet ? <span className="ml-1 text-xs text-slate-800">(testnet)</span> : ""}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{c.error ? <span className="text-red-400">error</span> : c.balance > 0 ? `${c.balance.toFixed(6)} ${c.nativeToken}` : <span className="text-slate-500">-</span>}</td>
                            <td className="px-3 py-2 text-right">{c.error ? "-" : c.txCount > 0 ? c.txCount : <span className="text-slate-500">-</span>}</td>
                            <td className="px-3 py-2 text-center">{c.error ? "-" : c.isContract ? <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">{c.contractVerified ? "Contract (verified)" : "Contract"}</span> : c.balance > 0 || c.txCount > 0 ? <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">EOA</span> : <span className="text-slate-500">-</span>}</td>
                            <td className="px-3 py-2 text-right">{c.tokenBalances?.length ? c.tokenBalances.map((t: { symbol: string; balance: number }) => <span key={t.symbol} className="inline-block mr-2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">${t.balance.toFixed(2)} {t.symbol}</span>) : <span className="text-slate-500">-</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ExpandableSection>
              )}

              {/* Mechanism Impact */}
              {projectResult.mechanismImpacts?.length > 0 && (
                <ExpandableSection title="Mechanism Simulation (4 QF Variants)">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-slate-100 text-slate-700 uppercase text-xs">
                        <th className="px-3 py-2 text-left">Mechanism</th>
                        <th className="px-3 py-2 text-right">Allocated</th>
                        <th className="px-3 py-2 text-right">Change vs Standard</th>
                      </tr></thead>
                      <tbody>
                        {projectResult.mechanismImpacts.map((m: { name: string; allocated: number; change: number }) => (
                          <tr key={m.name} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium">{m.name}</td>
                            <td className="px-3 py-2 text-right font-mono">{m.allocated.toFixed(4)} ETH</td>
                            <td className="px-3 py-2 text-right">
                              <span className={`font-bold ${m.change > 0 ? "text-green-600" : m.change < 0 ? "text-red-600" : "text-slate-700"}`}>
                                {m.change > 0 ? "+" : ""}{m.change.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ExpandableSection>
              )}

              {/* Temporal Anomalies */}
              {projectResult.anomalies?.length > 0 && (
                <ExpandableSection title={`Temporal Anomalies (${projectResult.anomalies.length} detected)`}>
                  <div className="space-y-2">
                    {projectResult.anomalies.map((a: { type: string; severity: string; description: string; epoch: number }, i: number) => (
                      <div key={i} className={`p-3 rounded-xl border ${
                        a.severity === "high" ? "bg-red-50 border-red-200" :
                        a.severity === "medium" ? "bg-amber-50 border-amber-200" :
                        "bg-blue-50 border-blue-200"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${a.severity === "high" ? "bg-red-500" : a.severity === "medium" ? "bg-amber-500" : "bg-blue-500"}`} />
                          <span className={`text-sm font-semibold capitalize ${a.severity === "high" ? "text-red-700" : a.severity === "medium" ? "text-amber-700" : "text-blue-700"}`}>{a.type?.replace(/_/g, " ")}</span>
                          <span className="text-xs text-slate-700">Epoch {a.epoch}</span>
                          <span className={`ml-auto text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                            a.severity === "high" ? "bg-red-100 text-red-600" : a.severity === "medium" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                          }`}>{a.severity}</span>
                        </div>
                        <p className="text-xs text-slate-800">{a.description}</p>
                      </div>
                    ))}
                  </div>
                </ExpandableSection>
              )}

              {/* Funding History */}
              {projectResult.history?.length > 0 && (
                <ExpandableSection title={`Cross-Epoch Funding History (${projectResult.history.length} epochs)`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-slate-100 text-slate-700 uppercase text-xs">
                        <th className="px-3 py-2 text-left">Epoch</th>
                        <th className="px-3 py-2 text-right">Allocated (ETH)</th>
                        <th className="px-3 py-2 text-right">Matched (ETH)</th>
                        <th className="px-3 py-2 text-right">Donors</th>
                      </tr></thead>
                      <tbody>
                        {projectResult.history.map((h: { epoch: number; allocated: number; matched: number; donors: number }) => (
                          <tr key={h.epoch} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium">Epoch {h.epoch}</td>
                            <td className="px-3 py-2 text-right font-mono">{h.allocated?.toFixed(4)}</td>
                            <td className="px-3 py-2 text-right font-mono">{h.matched?.toFixed(4)}</td>
                            <td className="px-3 py-2 text-right">{h.donors}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ExpandableSection>
              )}

              {/* Trust Flags */}
              {projectResult.trust?.flags?.length > 0 && (
                <ExpandableSection title={`Trust Flags (${projectResult.trust.flags.length})`}>
                  <div className="space-y-2">
                    {projectResult.trust.flags.map((f: string, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2">
                        <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                        <span className="text-sm text-red-700 font-medium">{f}</span>
                      </div>
                    ))}
                  </div>
                </ExpandableSection>
              )}

              {/* PDF Report */}
              {projectResult.reportPath && (
                <div className="flex gap-3 pt-3">
                  <button onClick={() => { const f = String(projectResult.reportPath).split("/").pop(); setViewPdf(`/api/reports/${f}`); }}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl px-6 py-2.5 shadow-lg shadow-indigo-500/25 transition flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    View PDF Report
                  </button>
                  <a href={`/api/reports/${String(projectResult.reportPath).split("/").pop()}`} download
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl px-6 py-2.5 transition">
                    Download
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ REPORTS SECTION ═══════ */}
        <div className="mt-8 bg-white/80 backdrop-blur-2xl rounded-3xl border border-slate-200/60 shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 mb-1">PDF Reports</h3>
              <p className="text-xs text-slate-700">Generated intelligence reports</p>
            </div>
            <button onClick={() => getReports().then(setReports).catch(() => {})}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg px-4 py-2 transition">
              Refresh
            </button>
          </div>
          {reports?.reports?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {reports.reports.map((r) => (
                <div key={r.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/50">
                  <div className="min-w-0 mr-3">
                    <p className="text-xs font-medium text-slate-700 font-mono truncate">{r.name}</p>
                    <p className="text-xs text-slate-800">{r.modTime} -- {(r.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {r.name.endsWith(".pdf") && (
                      <button onClick={() => setViewPdf(getReportUrl(r.name))}
                        className="text-xs px-2.5 py-1 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 transition">View</button>
                    )}
                    <a href={getReportUrl(r.name)} download className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 hover:bg-slate-200 transition">Download</a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-700">No reports yet. Run analyze-project or evaluate to generate PDF reports.</p>
          )}
        </div>
      </main>

      {/* ─── PDF Viewer Modal ─── */}
      {viewPdf && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewPdf(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-800">Report Viewer</h3>
              <button onClick={() => setViewPdf(null)} className="text-slate-800 hover:text-slate-800 text-2xl leading-none">&times;</button>
            </div>
            <iframe src={viewPdf} className="flex-1 w-full rounded-b-2xl" />
          </div>
        </div>
      )}

      <footer className="text-center py-8 text-xs text-slate-700 border-t border-slate-200/50">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src="/tessera-icon-64.png" alt="Tessera" className="w-5 h-5" />
          <span className="font-semibold text-slate-800">Tessera</span>
        </div>
        Built by Yeheskiel Yunus Tame + Claude Opus 4.6 | The Synthesis Hackathon |{" "}
        <a href="https://github.com/yeheskieltame/Tessera" className="text-blue-500 hover:underline">GitHub</a>
      </footer>
      </div>
    </div>
  );
}
