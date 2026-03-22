const API_BASE =
  typeof window !== "undefined" ? "" : "http://localhost:8080";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* ─── Types matching actual Go API responses ─── */

export interface ServiceStatus {
  name: string;
  status: string;
  detail: string;
}

export interface StatusResponse {
  services: ServiceStatus[];
}

export interface EpochResponse {
  currentEpoch: number;
}

export interface ProjectScore {
  address: string;
  allocated: number;
  matched: number;
  totalFunding: number;
  compositeScore: number;
  cluster: number;
}

export interface AnalyzeEpochResponse {
  epoch: number;
  projects: ProjectScore[];
}

export interface TrustProfile {
  address: string;
  donorCount: number;
  uniqueDonors: number;
  donorDiversity: number;
  whaleDepRatio: number;
  coordinationRisk: number;
  repeatDonors: number;
  flags: string[];
}

export interface TrustGraphResponse {
  epoch: number;
  profiles: TrustProfile[];
}

export interface MechanismProject {
  address: string;
  allocated: number;
  originalAlloc: number;
  change: number;
}

export interface MechanismResult {
  name: string;
  description: string;
  giniCoeff: number;
  topShare: number;
  aboveThreshold: number;
  projects: MechanismProject[];
}

export interface SimulateResponse {
  epoch: number;
  mechanisms: MechanismResult[];
}

export interface ReportEntry {
  name: string;
  size: number;
  modTime: string;
}

export interface ReportsResponse {
  reports: ReportEntry[];
}

export interface AnalyzeStep {
  step: string;
  status: string;
  message?: string;
  data?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface ProviderInfo {
  name: string;
  model: string;
  ready: boolean;
  reason?: string;
  default?: boolean;
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
  preferred: string;
  preferredModel: string;
}

/* ─── API functions ─── */

export async function getStatus(): Promise<StatusResponse> {
  return fetchJson("/api/status");
}

export async function getProviders(): Promise<ProvidersResponse> {
  return fetchJson("/api/providers");
}

export async function selectProvider(providerName: string, model: string): Promise<{ preferred: string; preferredModel: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/providers/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: providerName, model }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function getCurrentEpoch(): Promise<EpochResponse> {
  return fetchJson("/api/epochs/current");
}

export async function analyzeEpoch(
  epoch: number
): Promise<AnalyzeEpochResponse> {
  return fetchJson(`/api/analyze-epoch?epoch=${epoch}`);
}

export async function getTrustGraph(
  epoch: number
): Promise<TrustGraphResponse> {
  return fetchJson(`/api/trust-graph?epoch=${epoch}`);
}

export async function getSimulation(
  epoch: number
): Promise<SimulateResponse> {
  return fetchJson(`/api/simulate?epoch=${epoch}`);
}

export async function getReports(): Promise<ReportsResponse> {
  return fetchJson("/api/reports");
}

export function getReportUrl(filename: string): string {
  return `${API_BASE}/api/reports/${encodeURIComponent(filename)}`;
}

export function streamAnalyzeProject(
  address: string,
  epoch?: number
): EventSource {
  let url = `${API_BASE}/api/analyze-project/stream?address=${encodeURIComponent(address)}`;
  if (epoch) {
    url += `&epoch=${epoch}`;
  }
  return new EventSource(url);
}

export function streamEvaluateProject(
  name: string,
  description: string,
  githubURL?: string
): EventSource {
  let url = `${API_BASE}/api/evaluate/stream?name=${encodeURIComponent(name)}&description=${encodeURIComponent(description)}`;
  if (githubURL) {
    url += `&githubURL=${encodeURIComponent(githubURL)}`;
  }
  return new EventSource(url);
}

/* ─── Local Claude Bridge ─── */

const BRIDGE_DEFAULT_URL = "http://localhost:9877";

export interface BridgeStatus {
  ok: boolean;
  version: string;
  models: string[];
}

export async function detectBridge(url?: string): Promise<BridgeStatus | null> {
  const base = url || BRIDGE_DEFAULT_URL;
  try {
    const res = await fetch(`${base}/api/status`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? data as BridgeStatus : null;
  } catch {
    return null;
  }
}

export async function bridgePrompt(
  prompt: string,
  system?: string,
  model?: string,
  url?: string
): Promise<string> {
  const base = url || BRIDGE_DEFAULT_URL;
  const res = await fetch(`${base}/api/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, system, model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Bridge error" }));
    throw new Error(err.error || `Bridge error ${res.status}`);
  }
  const data = await res.json();
  return data.text;
}

export async function connectBridgeToServer(bridgeUrl: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/providers/bridge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bridgeUrl }),
  });
  if (!res.ok) throw new Error(`Failed to connect bridge: ${res.status}`);
}

export async function disconnectBridge(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/providers/bridge`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to disconnect bridge: ${res.status}`);
}
