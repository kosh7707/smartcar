import type {
  AnalysisResult,
  Rule,
  Project,
  ProjectCreateRequest,
  ProjectResponse,
  ProjectListResponse,
  ProjectOverviewResponse,
  ProjectFilesResponse,
  RuleCreateRequest,
  RuleUpdateRequest,
  RuleResponse,
  RuleListResponse,
  StaticAnalysisResponse,
  UploadedFile,
  DynamicAnalysisSession,
  DynamicAnalysisSessionResponse,

  CanMessage,
  DynamicAlert,
  DynamicTestConfig,
  DynamicTestResult,
  DynamicTestResponse,
  Adapter,
  AdapterCreateRequest,
  AdapterUpdateRequest,
  AdapterListResponse,
  AdapterResponse,
  ProjectSettings,
  ProjectReport,
  ProjectReportResponse,
  ModuleReport,
  ModuleReportResponse,

  StaticAnalysisDashboardSummary,
  StaticDashboardResponse,
  RunDetailResponse,
  AnalysisProgress,
  AnalysisStatusResponse,
  AnalysisStatusListResponse,
  AnalysisRunAcceptedResponse,
  Run,
  Finding,
  FindingStatus,
  RunListResponse,
  FindingListResponse,
  FindingDetailResponse,
  FindingStatusUpdateRequest,
  BuildTarget,
  BuildProfile,
} from "@aegis/shared";

const DEFAULT_BACKEND_URL = "http://localhost:3000";
const STORAGE_KEY = "aegis:backendUrl";

export function getBackendUrl(): string {
  return localStorage.getItem(STORAGE_KEY)
    ?? window.api?.backendUrl
    ?? DEFAULT_BACKEND_URL;
}

export function setBackendUrl(url: string): void {
  if (url.trim()) {
    localStorage.setItem(STORAGE_KEY, url.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function getBaseUrl(): string {
  return getBackendUrl();
}

// ── Error handling ──

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_INPUT: "입력값이 올바르지 않습니다.",
  NOT_FOUND: "요청한 리소스를 찾을 수 없습니다.",
  CONFLICT: "이미 실행 중인 작업이 있습니다.",
  ADAPTER_UNAVAILABLE: "어댑터에 연결할 수 없습니다. 연결 상태를 확인하세요.",
  LLM_UNAVAILABLE: "LLM 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
  LLM_HTTP_ERROR: "LLM 서버에서 오류가 발생했습니다.",
  LLM_PARSE_ERROR: "LLM 응답을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.",
  LLM_TIMEOUT: "LLM 서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.",
  DB_ERROR: "데이터베이스 오류가 발생했습니다.",
  INTERNAL_ERROR: "서버 내부 오류가 발생했습니다.",
};

export class ApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId: string;

  constructor(message: string, code: string, retryable: boolean, requestId: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryable = retryable;
    this.requestId = requestId;
  }
}

/** Extract requestId from ApiError and log with context. */
export function logError(context: string, e: unknown): void {
  const requestId = e instanceof ApiError ? e.requestId : undefined;
  const msg = e instanceof Error ? e.message : String(e);
  if (requestId) {
    console.error(`[${context}] ${msg} (requestId: ${requestId})`);
  } else {
    console.error(`[${context}]`, msg, e);
  }
}

/** Health check with X-Request-Id. Returns ok status without throwing. */
export async function healthFetch(url: string): Promise<{ ok: boolean; data?: Record<string, unknown> }> {
  const trimmed = url?.trim().replace(/\/+$/, "");
  if (!trimmed) return { ok: false };

  const requestId = crypto.randomUUID();
  try {
    const res = await fetch(`${trimmed}/health`, {
      headers: { "X-Request-Id": requestId },
    });
    const data = await res.json();
    return { ok: data?.status === "ok", data };
  } catch {
    console.warn(`[healthFetch] ${trimmed} unreachable (requestId: ${requestId})`);
    return { ok: false };
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const requestId = crypto.randomUUID();

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}${path}`, {
      ...options,
      headers: {
        ...options?.headers,
        "X-Request-Id": requestId,
      },
    });
  } catch {
    throw new ApiError(
      "서버에 연결할 수 없습니다. 네트워크를 확인하세요.",
      "NETWORK_ERROR", true, requestId,
    );
  }

  if (!res.ok) {
    let code = "UNKNOWN";
    let retryable = false;
    let msg: string;

    try {
      const body = await res.json();
      if (body.errorDetail) {
        code = body.errorDetail.code ?? code;
        retryable = body.errorDetail.retryable ?? false;
        msg = ERROR_MESSAGES[code] ?? body.errorDetail.message ?? `API 오류 (${res.status})`;
      } else {
        msg = body.error ?? `API 오류 (${res.status})`;
      }
    } catch {
      msg = res.status === 404
        ? "요청한 리소스를 찾을 수 없습니다."
        : res.status >= 500
          ? "서버 내부 오류가 발생했습니다."
          : `API 오류 (${res.status})`;
    }

    console.error(`[API ${res.status}] ${code} (requestId: ${requestId})`);
    throw new ApiError(msg, code, retryable, requestId);
  }

  try {
    return await res.json() as T;
  } catch {
    throw new ApiError(
      "서버 응답을 처리할 수 없습니다.",
      "PARSE_ERROR", false, requestId,
    );
  }
}

export async function healthCheck() {
  const api = window.api;
  if (api?.healthCheck) return api.healthCheck();
  return apiFetch("/health");
}

// ── Projects ──

export async function fetchProjects(): Promise<Project[]> {
  const res = await apiFetch<ProjectListResponse>("/api/projects");
  return res.data;
}

export async function fetchProject(id: string): Promise<Project> {
  const res = await apiFetch<ProjectResponse>(`/api/projects/${id}`);
  return res.data!;
}

export async function createProject(req: ProjectCreateRequest): Promise<Project> {
  const res = await apiFetch<ProjectResponse>("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.data!;
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
}

// ── Project Settings ──

export async function fetchProjectSettings(projectId: string): Promise<ProjectSettings> {
  const res = await apiFetch<{ success: boolean; data: ProjectSettings }>(`/api/projects/${projectId}/settings`);
  return res.data;
}

export async function updateProjectSettings(projectId: string, settings: Partial<ProjectSettings>): Promise<ProjectSettings> {
  const res = await apiFetch<{ success: boolean; data: ProjectSettings }>(`/api/projects/${projectId}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return res.data;
}

// ── Project Overview ──

export async function fetchProjectOverview(projectId: string): Promise<ProjectOverviewResponse> {
  return apiFetch<ProjectOverviewResponse>(`/api/projects/${projectId}/overview`);
}

// ── Static Analysis ──

export async function uploadFiles(projectId: string, files: File[]): Promise<UploadedFile[]> {
  const formData = new FormData();
  formData.append("projectId", projectId);
  files.forEach((f) => formData.append("files", f));

  // 폴더 업로드 시 상대 경로 전달
  const paths = files.map((f) => f.webkitRelativePath || f.name);
  formData.append("paths", JSON.stringify(paths));

  const res = await apiFetch<{ success: boolean; data: UploadedFile[] }>(
    "/api/static-analysis/upload",
    { method: "POST", body: formData },
  );
  return res.data;
}

export async function runStaticAnalysis(
  projectId: string,
  files: UploadedFile[],
): Promise<StaticAnalysisResponse> {
  return apiFetch<StaticAnalysisResponse>("/api/static-analysis/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, files }),
  });
}

export async function fetchAnalysisResults(projectId: string): Promise<AnalysisResult[]> {
  const res = await apiFetch<{ success: boolean; data: AnalysisResult[] }>(
    `/api/static-analysis/results?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data;
}

export async function fetchAnalysisResult(analysisId: string): Promise<AnalysisResult> {
  const res = await apiFetch<StaticAnalysisResponse>(`/api/static-analysis/results/${analysisId}`);
  return res.data!;
}

export async function deleteAnalysisResult(analysisId: string): Promise<void> {
  await apiFetch(`/api/static-analysis/results/${analysisId}`, { method: "DELETE" });
}

// ── Source Management ──

export interface SourceFileEntry {
  relativePath: string;
  size: number;
  language: string;
}

export interface SourceUploadResponse {
  projectPath: string;
  fileCount: number;
  files: SourceFileEntry[];
}

export async function uploadSource(projectId: string, file: File): Promise<SourceUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch<{ success: boolean; data: SourceUploadResponse }>(
    `/api/projects/${projectId}/source/upload`,
    { method: "POST", body: formData },
  );
  return res.data;
}

export async function cloneSource(projectId: string, url: string, branch?: string): Promise<SourceUploadResponse> {
  const res = await apiFetch<{ success: boolean; data: SourceUploadResponse }>(
    `/api/projects/${projectId}/source/clone`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, branch: branch || undefined }),
    },
  );
  return res.data;
}

export async function fetchSourceFiles(projectId: string): Promise<SourceFileEntry[]> {
  const res = await apiFetch<{ success: boolean; data: SourceFileEntry[] }>(
    `/api/projects/${projectId}/source/files`,
  );
  return res.data;
}

export interface SourceFileContentResponse {
  path: string;
  content: string;
  language: string;
  size: number;
}

export async function fetchSourceFileContent(
  projectId: string,
  path: string,
): Promise<SourceFileContentResponse> {
  const res = await apiFetch<{ success: boolean; data: SourceFileContentResponse }>(
    `/api/projects/${projectId}/source/file?path=${encodeURIComponent(path)}`,
  );
  return res.data;
}

// ── New Analysis API ──

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

// ── Project Files ──

export async function fetchProjectFiles(projectId: string): Promise<UploadedFile[]> {
  const res = await apiFetch<ProjectFilesResponse>(`/api/projects/${projectId}/files`);
  return res.data;
}

export async function downloadFile(fileId: string): Promise<string> {
  const requestId = crypto.randomUUID();
  const res = await fetch(`${getBaseUrl()}/api/files/${fileId}/download`, {
    headers: { "X-Request-Id": requestId },
  });
  if (!res.ok) throw new ApiError(`Download failed: ${res.status}`, "DOWNLOAD_ERROR", false, requestId);
  return res.text();
}

export interface FileContentResponse {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
}

export async function fetchFileContent(fileId: string): Promise<FileContentResponse> {
  const res = await apiFetch<{ success: boolean; data: FileContentResponse }>(`/api/files/${fileId}/content`);
  return res.data;
}

export async function deleteProjectFile(projectId: string, fileId: string): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/files/${fileId}`, { method: "DELETE" });
}

// ── Dynamic Analysis ──

export function getWsBaseUrl(): string {
  return getBaseUrl().replace(/^http/, "ws");
}

export async function createDynamicSession(
  projectId: string,
  adapterId: string,
): Promise<DynamicAnalysisSession> {
  const res = await apiFetch<DynamicAnalysisSessionResponse>("/api/dynamic-analysis/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, adapterId }),
  });
  return res.data!;
}

export async function fetchDynamicSessions(projectId: string): Promise<DynamicAnalysisSession[]> {
  const res = await apiFetch<{ success: boolean; data: DynamicAnalysisSession[] }>(
    `/api/dynamic-analysis/sessions?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data;
}

interface DynamicSessionDetail {
  session: DynamicAnalysisSession;
  alerts: DynamicAlert[];
  recentMessages: CanMessage[];
}

export async function fetchDynamicSessionDetail(sessionId: string): Promise<DynamicSessionDetail> {
  const res = await apiFetch<{ success: boolean; data: DynamicSessionDetail }>(
    `/api/dynamic-analysis/sessions/${sessionId}`,
  );
  return res.data;
}

export async function startDynamicSession(sessionId: string): Promise<DynamicAnalysisSession> {
  const res = await apiFetch<DynamicAnalysisSessionResponse>(
    `/api/dynamic-analysis/sessions/${sessionId}/start`,
    { method: "POST" },
  );
  return res.data!;
}

export async function stopDynamicSession(sessionId: string): Promise<DynamicAnalysisSession> {
  const res = await apiFetch<DynamicAnalysisSessionResponse>(
    `/api/dynamic-analysis/sessions/${sessionId}`,
    { method: "DELETE" },
  );
  return res.data!;
}

// ── CAN Injection ──

export async function fetchScenarios(): Promise<import("@aegis/shared").AttackScenario[]> {
  const res = await apiFetch<{ success: boolean; data: import("@aegis/shared").AttackScenario[] }>(
    "/api/dynamic-analysis/scenarios",
  );
  return res.data;
}

export async function injectCanMessage(
  sessionId: string,
  req: import("@aegis/shared").CanInjectionRequest,
): Promise<import("@aegis/shared").CanInjectionResponse> {
  const res = await apiFetch<{ success: boolean; data: import("@aegis/shared").CanInjectionResponse }>(
    `/api/dynamic-analysis/sessions/${sessionId}/inject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    },
  );
  return res.data;
}

export async function injectScenario(
  sessionId: string,
  scenarioId: string,
): Promise<import("@aegis/shared").CanInjectionResponse[]> {
  const res = await apiFetch<{ success: boolean; data: import("@aegis/shared").CanInjectionResponse[] }>(
    `/api/dynamic-analysis/sessions/${sessionId}/inject-scenario`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId }),
    },
  );
  return res.data;
}

export async function fetchInjections(
  sessionId: string,
): Promise<import("@aegis/shared").CanInjectionResponse[]> {
  const res = await apiFetch<{ success: boolean; data: import("@aegis/shared").CanInjectionResponse[] }>(
    `/api/dynamic-analysis/sessions/${sessionId}/injections`,
  );
  return res.data;
}

// ── Adapters ──

export async function fetchAdapters(projectId: string): Promise<Adapter[]> {
  const res = await apiFetch<AdapterListResponse>(`/api/projects/${projectId}/adapters`);
  return res.data;
}

export async function createAdapter(projectId: string, req: AdapterCreateRequest): Promise<Adapter> {
  const res = await apiFetch<AdapterResponse>(`/api/projects/${projectId}/adapters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.data!;
}

export async function updateAdapter(projectId: string, id: string, req: AdapterUpdateRequest): Promise<Adapter> {
  const res = await apiFetch<AdapterResponse>(`/api/projects/${projectId}/adapters/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.data!;
}

export async function deleteAdapter(projectId: string, id: string): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/adapters/${id}`, { method: "DELETE" });
}

export async function connectAdapterById(projectId: string, id: string): Promise<Adapter> {
  const res = await apiFetch<AdapterResponse>(`/api/projects/${projectId}/adapters/${id}/connect`, {
    method: "POST",
  });
  if (!res.success) throw new Error(res.error ?? "연결 실패");
  return res.data!;
}

export async function disconnectAdapterById(projectId: string, id: string): Promise<Adapter> {
  const res = await apiFetch<AdapterResponse>(`/api/projects/${projectId}/adapters/${id}/disconnect`, {
    method: "POST",
  });
  return res.data!;
}

// ── Dynamic Test ──

export async function runDynamicTest(
  projectId: string,
  config: DynamicTestConfig,
  adapterId: string,
  testId?: string,
): Promise<DynamicTestResult> {
  const res = await apiFetch<DynamicTestResponse>("/api/dynamic-test/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, config, adapterId, testId }),
  });
  return res.data!;
}

export async function getDynamicTestResults(
  projectId: string,
): Promise<DynamicTestResult[]> {
  const res = await apiFetch<{ success: boolean; data: DynamicTestResult[] }>(
    `/api/dynamic-test/results?projectId=${encodeURIComponent(projectId)}`,
  );
  return res.data;
}

export async function getDynamicTestResult(testId: string): Promise<DynamicTestResult> {
  const res = await apiFetch<DynamicTestResponse>(`/api/dynamic-test/results/${testId}`);
  return res.data!;
}

export async function deleteDynamicTestResult(testId: string): Promise<void> {
  await apiFetch(`/api/dynamic-test/results/${testId}`, { method: "DELETE" });
}

// ── Rules ──

export async function fetchRules(projectId: string): Promise<Rule[]> {
  const res = await apiFetch<RuleListResponse>(`/api/projects/${projectId}/rules`);
  return res.data;
}

export async function createRule(projectId: string, rule: RuleCreateRequest): Promise<Rule> {
  const res = await apiFetch<RuleResponse>(`/api/projects/${projectId}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });
  return res.data!;
}

export async function updateRule(projectId: string, id: string, updates: RuleUpdateRequest): Promise<Rule> {
  const res = await apiFetch<RuleResponse>(`/api/projects/${projectId}/rules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return res.data!;
}

export async function deleteRule(projectId: string, id: string): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/rules/${id}`, { method: "DELETE" });
}

// ── Static Analysis Dashboard ──

export async function fetchStaticDashboardSummary(
  projectId: string,
  period: string = "30d",
): Promise<StaticAnalysisDashboardSummary> {
  const res = await apiFetch<StaticDashboardResponse>(
    `/api/analysis/summary?projectId=${encodeURIComponent(projectId)}&period=${period}`,
  );
  return res.data!;
}

export async function runStaticAnalysisAsync(
  projectId: string,
  files: UploadedFile[],
): Promise<AnalysisRunAcceptedResponse> {
  return apiFetch<AnalysisRunAcceptedResponse>("/api/static-analysis/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, files }),
  });
}

export async function fetchAnalysisProgress(id: string): Promise<AnalysisProgress> {
  const res = await apiFetch<AnalysisStatusResponse>(`/api/static-analysis/status/${id}`);
  return res.data!;
}

export async function fetchAllAnalysisStatuses(): Promise<AnalysisProgress[]> {
  const res = await apiFetch<AnalysisStatusListResponse>("/api/static-analysis/status");
  return res.data;
}

export async function abortAnalysis(id: string): Promise<void> {
  await apiFetch(`/api/static-analysis/abort/${id}`, { method: "POST" });
}

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
): Promise<Finding & { evidenceRefs: import("@aegis/shared").EvidenceRef[]; auditLog: import("@aegis/shared").AuditLogEntry[] }> {
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

// ── Report ──

export interface ReportFilters {
  from?: string;
  to?: string;
  severity?: string;
  status?: string;
  runId?: string;
}

function buildReportQuery(filters?: ReportFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.status) params.set("status", filters.status);
  if (filters.runId) params.set("runId", filters.runId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchProjectReport(projectId: string, filters?: ReportFilters): Promise<ProjectReport> {
  const res = await apiFetch<ProjectReportResponse>(`/api/projects/${projectId}/report${buildReportQuery(filters)}`);
  return res.data!;
}

export async function fetchModuleReport(projectId: string, module: "static" | "dynamic" | "test", filters?: ReportFilters): Promise<ModuleReport> {
  const res = await apiFetch<ModuleReportResponse>(`/api/projects/${projectId}/report/${module}${buildReportQuery(filters)}`);
  return res.data!;
}

// ── Build Targets ──

export async function fetchBuildTargets(projectId: string): Promise<BuildTarget[]> {
  const res = await apiFetch<{ success: boolean; data: BuildTarget[] }>(
    `/api/projects/${projectId}/targets`,
  );
  return res.data;
}

export async function createBuildTarget(
  projectId: string,
  body: { name: string; relativePath: string; buildProfile?: BuildProfile },
): Promise<BuildTarget> {
  const res = await apiFetch<{ success: boolean; data: BuildTarget }>(
    `/api/projects/${projectId}/targets`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

export async function updateBuildTarget(
  projectId: string,
  targetId: string,
  body: { name?: string; buildProfile?: BuildProfile },
): Promise<BuildTarget> {
  const res = await apiFetch<{ success: boolean; data: BuildTarget }>(
    `/api/projects/${projectId}/targets/${targetId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

export async function deleteBuildTarget(
  projectId: string,
  targetId: string,
): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/targets/${targetId}`, { method: "DELETE" });
}

export async function discoverBuildTargets(projectId: string): Promise<BuildTarget[]> {
  const res = await apiFetch<{ success: boolean; data: BuildTarget[] }>(
    `/api/projects/${projectId}/targets/discover`,
    { method: "POST" },
  );
  return res.data;
}
