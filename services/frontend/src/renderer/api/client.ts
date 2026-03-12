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
} from "@smartcar/shared";

const DEFAULT_BACKEND_URL = "http://localhost:3000";
const STORAGE_KEY = "smartcar:backendUrl";

export function getBackendUrl(): string {
  return localStorage.getItem(STORAGE_KEY)
    ?? (window as any).api?.backendUrl
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
  const api = (window as any).api;
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
  const paths = files.map((f) => (f as any).webkitRelativePath || f.name);
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

// ── Project Files ──

export async function fetchProjectFiles(projectId: string): Promise<UploadedFile[]> {
  const res = await apiFetch<ProjectFilesResponse>(`/api/projects/${projectId}/files`);
  return res.data;
}

export async function downloadFile(fileId: string): Promise<string> {
  const res = await fetch(`${(window as any).api?.backendUrl ?? "http://localhost:3000"}/api/files/${fileId}/download`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
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

export async function fetchScenarios(): Promise<import("@smartcar/shared").AttackScenario[]> {
  const res = await apiFetch<{ success: boolean; data: import("@smartcar/shared").AttackScenario[] }>(
    "/api/dynamic-analysis/scenarios",
  );
  return res.data;
}

export async function injectCanMessage(
  sessionId: string,
  req: import("@smartcar/shared").CanInjectionRequest,
): Promise<import("@smartcar/shared").CanInjectionResponse> {
  const res = await apiFetch<{ success: boolean; data: import("@smartcar/shared").CanInjectionResponse }>(
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
): Promise<import("@smartcar/shared").CanInjectionResponse[]> {
  const res = await apiFetch<{ success: boolean; data: import("@smartcar/shared").CanInjectionResponse[] }>(
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
): Promise<import("@smartcar/shared").CanInjectionResponse[]> {
  const res = await apiFetch<{ success: boolean; data: import("@smartcar/shared").CanInjectionResponse[] }>(
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
