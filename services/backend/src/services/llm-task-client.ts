/**
 * S3 v1 Task API 클라이언트
 *
 * v0 LlmClient는 2026-03-13에 제거됨. LlmV1Adapter가 이 클라이언트를 래핑하여
 * 기존 서비스(정적/동적/테스트)에 v0 호환 시그니처를 제공한다.
 * API 계약: docs/api/llm-gateway-api.md
 */
import { createLogger } from "../lib/logger";
import {
  LlmUnavailableError,
  LlmHttpError,
  LlmParseError,
  LlmTimeoutError,
} from "../lib/errors";

const logger = createLogger("llm-task-client");

// ── v1 요청 타입 ──

export type TaskType =
  | "static-explain"
  | "static-cluster"
  | "dynamic-annotate"
  | "test-plan-propose"
  | "report-draft";

export interface TaskEvidenceRef {
  refId: string;
  artifactId: string;
  artifactType: string;
  locatorType: string;
  locator: Record<string, unknown>;
  hash?: string;
  label?: string;
}

export interface TaskRequest {
  taskType: TaskType;
  taskId: string;
  context: {
    trusted: Record<string, unknown>;
    semiTrusted?: Record<string, unknown>;
    untrusted?: Record<string, unknown>;
  };
  evidenceRefs: TaskEvidenceRef[];
  constraints?: {
    maxTokens?: number;
    timeoutMs?: number;
    outputSchema?: string;
  };
  metadata?: {
    runId?: string;
    requestedBy?: string;
  };
}

// ── v1 응답 타입 ──

export interface TaskClaim {
  statement: string;
  supportingEvidenceRefs: string[];
}

export interface TaskResult {
  summary: string;
  claims: TaskClaim[];
  caveats: string[];
  usedEvidenceRefs: string[];
  suggestedSeverity?: string;
  confidence: number;
  confidenceBreakdown: {
    grounding: number;
    deterministicSupport: number;
    consistency: number;
    schemaCompliance: number;
  };
  needsHumanReview: boolean;
  recommendedNextSteps: string[];
  policyFlags: string[];
  plan?: Record<string, unknown>;
}

export interface TaskAudit {
  inputHash: string;
  latencyMs: number;
  tokenUsage: Record<string, number>;
  retryCount: number;
  createdAt: string;
}

export interface TaskResponseSuccess {
  taskId: string;
  taskType: string;
  status: "completed";
  modelProfile: string;
  promptVersion: string;
  schemaVersion: string;
  validation: { valid: boolean; errors: string[] };
  result: TaskResult;
  audit: TaskAudit;
}

export interface TaskResponseFailure {
  taskId: string;
  taskType: string;
  status:
    | "validation_failed"
    | "timeout"
    | "model_error"
    | "budget_exceeded"
    | "unsafe_output"
    | "empty_result";
  failureCode: string;
  failureDetail: string;
  audit: TaskAudit;
}

export type TaskResponse = TaskResponseSuccess | TaskResponseFailure;

// ── 클라이언트 ──

export class LlmTaskClient {
  constructor(private baseUrl: string) {}

  async submitTask(
    request: TaskRequest,
    requestId?: string,
    options?: { signal?: AbortSignal; baseUrl?: string },
  ): Promise<TaskResponse> {
    const url = options?.baseUrl ?? this.baseUrl;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (requestId) headers["X-Request-Id"] = requestId;

    let res: Response;
    try {
      res = await fetch(`${url}/v1/tasks`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: options?.signal,
      });
    } catch (err) {
      // AbortError는 상위 전파
      if (err instanceof Error && err.name === "AbortError") {
        throw err;
      }
      const message = err instanceof Error ? err.message : "Network error";
      if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
        throw new LlmTimeoutError(`v1 Task API timeout: ${message}`, err);
      }
      throw new LlmUnavailableError(
        `v1 Task API unreachable: ${message}`,
        err,
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new LlmHttpError(
        `v1 Task API returned HTTP ${res.status}: ${body.slice(0, 200)}`,
      );
    }

    let data: TaskResponse;
    try {
      data = (await res.json()) as TaskResponse;
    } catch (err) {
      throw new LlmParseError(
        "Failed to parse v1 Task API response as JSON",
        err,
      );
    }

    if (data.status !== "completed") {
      const fail = data as TaskResponseFailure;
      logger.warn(
        {
          taskId: fail.taskId,
          status: fail.status,
          failureCode: fail.failureCode,
          latencyMs: fail.audit?.latencyMs,
          requestId,
        },
        "v1 Task failed: %s",
        fail.failureDetail,
      );
    } else {
      logger.info(
        {
          taskId: data.taskId,
          taskType: data.taskType,
          confidence: data.result.confidence,
          latencyMs: data.audit.latencyMs,
          requestId,
        },
        "v1 Task completed",
      );
    }

    return data;
  }

  isSuccess(response: TaskResponse): response is TaskResponseSuccess {
    return response.status === "completed";
  }

  async checkHealth(baseUrl?: string): Promise<Record<string, unknown> | null> {
    const url = baseUrl ?? this.baseUrl;
    try {
      const res = await fetch(`${url}/v1/health`);
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      logger.warn({ err }, "v1 health check failed");
      return null;
    }
  }
}
