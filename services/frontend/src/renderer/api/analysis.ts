import type {
  StaticAnalysisDashboardSummary,
  StaticDashboardResponse,
  RunDetailResponse,
  AnalysisProgress,
  AnalysisStatusListResponse,
  Run,
  Finding,
  FindingStatus,
  RunListResponse,
  FindingListResponse,
  FindingDetailResponse,
  FindingStatusUpdateRequest,
  EvidenceRef,
  AuditLogEntry,
} from "@aegis/shared";
import { apiFetch } from "./core";

// ── Analysis Status (active analysis polling) ──

export async function fetchAllAnalysisStatuses(): Promise<AnalysisProgress[]> {
  const res = await apiFetch<AnalysisStatusListResponse>("/api/analysis/status");
  return res.data;
}

// ── Analysis API ──

export async function runAnalysis(
  projectId: string,
  targetIds?: string[],
): Promise<{ analysisId: string; status: string }> {
  const body: Record<string, unknown> = { projectId };
  if (targetIds && targetIds.length > 0) body.targetIds = targetIds;
  const res = await apiFetch<{ success: boolean; data: { analysisId: string; status: string } }>(
    "/api/analysis/run",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

export interface PocResponse {
  findingId: string;
  poc: {
    statement: string;
    detail: string;
  };
  audit: {
    latencyMs: number;
    tokenUsage: { prompt: number; completion: number };
  };
}

export async function generatePoc(
  projectId: string,
  findingId: string,
): Promise<PocResponse> {
  const res = await apiFetch<{ success: boolean; data: PocResponse }>(
    "/api/analysis/poc",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, findingId }),
    },
  );
  return res.data;
}

// ── Dashboard Summary ──

export async function fetchStaticDashboardSummary(
  projectId: string,
  period: string = "30d",
): Promise<StaticAnalysisDashboardSummary> {
  const res = await apiFetch<StaticDashboardResponse>(
    `/api/analysis/summary?projectId=${encodeURIComponent(projectId)}&period=${period}`,
  );
  return res.data!;
}

// ── Runs & Findings ──

export async function fetchProjectRuns(projectId: string): Promise<Run[]> {
  const res = await apiFetch<RunListResponse>(`/api/projects/${projectId}/runs`);
  return res.data;
}

export async function fetchRunDetail(runId: string): Promise<RunDetailResponse["data"]> {
  const res = await apiFetch<RunDetailResponse>(`/api/runs/${runId}`);
  return res.data!;
}

export async function fetchProjectFindings(
  projectId: string,
  filters?: { status?: string; severity?: string; module?: string },
): Promise<Finding[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.module) params.set("module", filters.module);
  const qs = params.toString();
  const res = await apiFetch<FindingListResponse>(
    `/api/projects/${projectId}/findings${qs ? `?${qs}` : ""}`,
  );
  return res.data;
}

export async function fetchFindingDetail(
  findingId: string,
): Promise<Finding & { evidenceRefs: EvidenceRef[]; auditLog: AuditLogEntry[] }> {
  const res = await apiFetch<FindingDetailResponse>(`/api/findings/${findingId}`);
  return res.data!;
}

export async function updateFindingStatus(
  findingId: string,
  status: FindingStatus,
  reason: string,
): Promise<Finding> {
  const res = await apiFetch<{ success: boolean; data: Finding }>(`/api/findings/${findingId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reason } satisfies FindingStatusUpdateRequest),
  });
  return res.data;
}
