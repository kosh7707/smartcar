/**
 * S5 Knowledge Base HTTP 클라이언트
 *
 * API 계약: docs/api/knowledge-base-api.md
 * POST /v1/code-graph/{projectId}/ingest — 코드그래프 적재
 * GET  /v1/code-graph/{projectId}/stats  — 적재 통계
 * DELETE /v1/code-graph/{projectId}      — 코드그래프 삭제
 * GET  /v1/health                        — 서비스 상태
 */
import { createLogger } from "../lib/logger";
import type { SastCodeGraph } from "./sast-client";

const logger = createLogger("kb-client");

export interface CodeGraphIngestResponse {
  success: boolean;
  project_id: string;
  nodes_created: number;
  edges_created: number;
  elapsed_ms: number;
  error?: string;
}

export interface CodeGraphStatsResponse {
  project_id: string;
  function_count: number;
  call_edge_count: number;
}

export class KbClient {
  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_BASE_MS = 2000;

  constructor(private baseUrl: string) {}

  async ingestCodeGraph(
    projectId: string,
    codeGraph: SastCodeGraph,
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<CodeGraphIngestResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (requestId) headers["X-Request-Id"] = requestId;

    const res = await this.doFetch(
      `${this.baseUrl}/v1/code-graph/${encodeURIComponent(projectId)}/ingest`,
      headers,
      { functions: codeGraph.functions, call_edges: codeGraph.callEdges },
      requestId,
      signal,
    );

    try {
      return (await res.json()) as CodeGraphIngestResponse;
    } catch (err) {
      throw new Error(`Failed to parse KB ingest response: ${err}`);
    }
  }

  async getCodeGraphStats(
    projectId: string,
    requestId?: string,
  ): Promise<CodeGraphStatsResponse | null> {
    try {
      const headers: Record<string, string> = {};
      if (requestId) headers["X-Request-Id"] = requestId;

      const res = await fetch(
        `${this.baseUrl}/v1/code-graph/${encodeURIComponent(projectId)}/stats`,
        { headers },
      );
      if (!res.ok) return null;
      return (await res.json()) as CodeGraphStatsResponse;
    } catch {
      return null;
    }
  }

  async deleteCodeGraph(
    projectId: string,
    requestId?: string,
  ): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (requestId) headers["X-Request-Id"] = requestId;

      const res = await fetch(
        `${this.baseUrl}/v1/code-graph/${encodeURIComponent(projectId)}`,
        { method: "DELETE", headers },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Liveness — S5가 살아있는지 확인 */
  async checkHealth(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/health`);
      return (await res.json()) as Record<string, unknown>;
    } catch {
      logger.warn("KB health check failed");
      return null;
    }
  }

  /** Readiness — S5가 완전 초기화(Neo4j, Qdrant 등) 되었는지 확인 */
  async checkReady(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/ready`);
      if (!res.ok) return null;
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private async doFetch(
    url: string,
    headers: Record<string, string>,
    body: unknown,
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<Response> {
    const bodyStr = JSON.stringify(body);

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, { method: "POST", headers, body: bodyStr, signal });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        throw new Error(`KB unreachable: ${err instanceof Error ? err.message : "Network error"}`);
      }

      if (res.status === 503 && attempt < KbClient.MAX_RETRIES) {
        const delay = KbClient.RETRY_BASE_MS * 2 ** attempt;
        logger.warn({ attempt: attempt + 1, delayMs: delay, requestId }, "KB overloaded (503), retrying");
        await this.sleep(delay, signal);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`KB returned HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      return res;
    }
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) { reject(signal.reason); return; }
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    });
  }
}
