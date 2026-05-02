import type {
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
  AttackScenario,
  CanInjectionRequest,
  CanInjectionResponse,
} from "@aegis/shared";
import { apiFetch } from "./core";

// ── Dynamic Analysis Sessions ──

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

export interface DynamicSessionDetail {
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

export async function fetchScenarios(): Promise<AttackScenario[]> {
  const res = await apiFetch<{ success: boolean; data: AttackScenario[] }>(
    "/api/dynamic-analysis/scenarios",
  );
  return res.data;
}

export async function injectCanMessage(
  sessionId: string,
  req: CanInjectionRequest,
): Promise<CanInjectionResponse> {
  const res = await apiFetch<{ success: boolean; data: CanInjectionResponse }>(
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
): Promise<CanInjectionResponse[]> {
  const res = await apiFetch<{ success: boolean; data: CanInjectionResponse[] }>(
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
): Promise<CanInjectionResponse[]> {
  const res = await apiFetch<{ success: boolean; data: CanInjectionResponse[] }>(
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

// ── Dynamic Tests ──

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
