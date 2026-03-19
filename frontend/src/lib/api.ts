const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface StatusResponse {
  octant: { connected: boolean; epoch: number };
  ai: { provider: string; model: string };
  gitcoin: { connected: boolean };
  oso: { connected: boolean };
}

export interface EpochInfo {
  epoch: number;
  fromTs: string;
  toTs: string;
  decisionWindow: number;
  totalBudget: string;
  totalAllocated: string;
  totalMatched: string;
  projectCount: number;
}

export interface ProjectScore {
  rank: number;
  address: string;
  name: string;
  allocated: string;
  matched: string;
  score: number;
  cluster: number;
}

export interface TrustNode {
  address: string;
  name: string;
  donors: number;
  diversity: number;
  whaleDependency: number;
  coordinationRisk: number;
  flags: string[];
}

export interface MechanismResult {
  name: string;
  gini: number;
  topShare: number;
  aboveThreshold: number;
}

export interface ReportEntry {
  filename: string;
  date: string;
  project: string;
  size: number;
}

export interface AnalyzeStep {
  step: number;
  name: string;
  status: "pending" | "running" | "done" | "error";
  data?: Record<string, unknown>;
  error?: string;
}

export async function getStatus(): Promise<StatusResponse> {
  return fetchJson("/api/status");
}

export async function getCurrentEpoch(): Promise<EpochInfo> {
  return fetchJson("/api/epochs/current");
}

export async function analyzeEpoch(epoch: number): Promise<ProjectScore[]> {
  return fetchJson(`/api/analyze-epoch?epoch=${epoch}`);
}

export async function getTrustGraph(epoch: number): Promise<TrustNode[]> {
  return fetchJson(`/api/trust-graph?epoch=${epoch}`);
}

export async function getSimulation(epoch: number): Promise<MechanismResult[]> {
  return fetchJson(`/api/simulate?epoch=${epoch}`);
}

export async function getReports(): Promise<ReportEntry[]> {
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
