// ── API Core Infrastructure ──

const DEFAULT_BACKEND_URL = import.meta.env.DEV && import.meta.env.MODE !== "test" ? "" : "http://localhost:3000";
const STORAGE_KEY = "aegis:backendUrl";

export interface HealthCheckResponse {
  status: "ok" | "degraded" | "unhealthy" | "disconnected" | "checking" | string;
  service?: string;
  version?: string;
  detail?: {
    version: string;
    uptime: number;
  };
}

export function getBackendUrl(): string {
  return localStorage.getItem(STORAGE_KEY)
    ?? DEFAULT_BACKEND_URL;
}

export function setBackendUrl(url: string): void {
  if (url.trim()) {
    localStorage.setItem(STORAGE_KEY, url.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getBaseUrl(): string {
  return getBackendUrl();
}

export function getWsBaseUrl(): string {
  return getBaseUrl().replace(/^http/, "ws");
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
  if (import.meta.env.VITE_MOCK === "true") {
    return { ok: true, data: { service: "aegis-backend", status: "ok", version: "0.7.0-mock", detail: { version: "0.7.0-mock", uptime: 9999 } } };
  }

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
  // Mock mode: bypass real fetch, use mock-handler
  if (import.meta.env.VITE_MOCK === "true") {
    const { mockApiFetch } = await import("./mock-handler");
    return mockApiFetch<T>(path, options);
  }

  const requestId = crypto.randomUUID();

  const headers: Record<string, string> = {
    ...options?.headers as Record<string, string>,
    "X-Request-Id": requestId,
  };
  const token = localStorage.getItem("aegis:authToken");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}${path}`, {
      ...options,
      headers,
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

export async function healthCheck(): Promise<HealthCheckResponse> {
  return apiFetch<HealthCheckResponse>("/health");
}
