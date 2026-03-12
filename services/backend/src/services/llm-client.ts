import { createLogger } from "../lib/logger";
import {
  LlmUnavailableError,
  LlmHttpError,
  LlmParseError,
  LlmTimeoutError,
} from "../lib/errors";

const logger = createLogger("llm-client");

export interface LlmAnalyzeRequest {
  module: string;
  sourceCode?: string;
  canLog?: string;
  testResults?: string;
  ruleResults?: Array<{
    ruleId: string;
    title: string;
    severity: string;
    location: string;
  }>;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmVulnerability {
  severity: string;
  title: string;
  description: string;
  location?: string | null;
  suggestion?: string | null;
  fixCode?: string | null;
}

export interface LlmAnalyzeResponse {
  success: boolean;
  vulnerabilities: LlmVulnerability[];
  note?: string;
  error?: string;
}

const VALID_LLM_SEVERITIES = new Set([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

/** S3에서 받은 severity 문자열을 검증하여 Severity 타입으로 반환한다. */
export function validateLlmSeverity(raw: string | undefined | null): string {
  const s = (raw ?? "").toLowerCase().trim();
  if (VALID_LLM_SEVERITIES.has(s)) return s;
  return "medium";
}

export class LlmClient {
  constructor(private baseUrl: string) {}

  async analyze(
    request: LlmAnalyzeRequest,
    baseUrl?: string,
    requestId?: string
  ): Promise<LlmAnalyzeResponse> {
    const url = baseUrl ?? this.baseUrl;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (requestId) headers["X-Request-Id"] = requestId;

    let res: Response;
    try {
      res = await fetch(`${url}/api/llm/analyze`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });
    } catch (err) {
      // 네트워크 에러 (DNS 실패, 연결 거부, 타임아웃 등)
      const message = err instanceof Error ? err.message : "Network error";
      if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
        throw new LlmTimeoutError(`LLM Gateway timeout: ${message}`, err);
      }
      throw new LlmUnavailableError(`LLM Gateway unreachable: ${message}`, err);
    }

    // HTTP 상태코드 검사
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new LlmHttpError(
        `LLM Gateway returned HTTP ${res.status}: ${body.slice(0, 200)}`,
      );
    }

    // JSON 파싱
    let data: LlmAnalyzeResponse;
    try {
      data = (await res.json()) as LlmAnalyzeResponse;
    } catch (err) {
      throw new LlmParseError("Failed to parse LLM Gateway response as JSON", err);
    }

    return data;
  }

  async checkHealth(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      logger.warn({ err }, "LLM Gateway health check failed");
      return null;
    }
  }
}
