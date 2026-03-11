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

  async analyze(request: LlmAnalyzeRequest, baseUrl?: string): Promise<LlmAnalyzeResponse> {
    try {
      const url = baseUrl ?? this.baseUrl;
      const res = await fetch(`${url}/api/llm/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      return (await res.json()) as LlmAnalyzeResponse;
    } catch {
      return {
        success: false,
        vulnerabilities: [],
        error: "LLM Gateway unreachable",
      };
    }
  }

  async checkHealth(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
