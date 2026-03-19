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

/* ─── API functions ─── */

export async function getStatus(): Promise<StatusResponse> {
  return fetchJson("/api/status");
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
