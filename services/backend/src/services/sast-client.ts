/**
 * S4 SAST Runner HTTP 클라이언트
 *
 * API 계약: docs/api/sast-runner-api.md
 * POST /v1/scan — 6개 SAST 도구 병렬 실행
 * GET  /v1/health — 서비스 상태
 */
import { createLogger } from "../lib/logger";
import {
  SastUnavailableError,
  SastTimeoutError,
} from "../lib/errors";
import type { BuildProfile, SastFinding } from "@aegis/shared";

const logger = createLogger("sast-client");

// ── 요청 타입 ──

export interface SastScanRequest {
  scanId: string;
  projectId: string;
  files?: Array<{ path: string; content: string }>;
  projectPath?: string;
  compileCommands?: string;
  buildProfile?: BuildProfile;
  rulesets?: string[];
  /** 포함된 서드파티 라이브러리 경로 (S4가 cross-boundary 필터링에 사용) */
  thirdPartyPaths?: string[];
  options?: {
    timeoutSeconds?: number;
    /** 실행할 도구 서브셋 (미지정 시 전체). 허용: semgrep, cppcheck, flawfinder, clang-tidy, scan-build, gcc-fanalyzer */
    tools?: string[];
  };
}

// ── 응답 타입 ──

export interface SastToolResult {
  findingsCount: number;
  elapsedMs: number;
  status: "ok" | "partial" | "skipped" | "failed";
  skipReason?: string;
  error?: string;
}

export interface SastScanErrorDetail {
  code?: string;
  message?: string;
  requestId?: string;
  retryable?: boolean;
}

export interface SastCodeGraph {
  functions: Array<{ name: string; file: string; line: number; complexity?: number }>;
  callEdges: Array<{ caller: string; callee: string; file: string; line: number }>;
  complexity?: Record<string, number>;
}

export interface SastScaLibrary {
  name: string;
  version?: string;
  path: string;
  repoUrl?: string;
}

export interface SastScanResponse {
  success: boolean;
  scanId: string;
  status: "completed" | "failed";
  findings: SastFinding[];
  stats: {
    filesScanned: number;
    rulesRun: number;
    findingsTotal: number;
    elapsedMs: number;
  };
  execution: {
    toolsRun: string[];
    toolResults: Record<string, SastToolResult>;
    sdk?: {
      resolved: boolean;
      sdkId: string;
      includePathsAdded: number;
    };
    filtering?: {
      beforeFilter: number;
      afterFilter: number;
      sdkNoiseRemoved: number;
      /** 서드파티 경로 제거 수 (thirdPartyPaths 전달 시) */
      thirdPartyRemoved?: number;
      /** cross-boundary로 유지된 finding 수 */
      crossBoundaryKept?: number;
      /** scope-early로 도구 실행 전 제외된 파일 수 */
      filesScopedOut?: number;
    };
  };
  /** 코드 구조 그래프 (projectPath 모드에서만 반환) */
  codeGraph?: SastCodeGraph | null;
  /** SCA 분석 결과 — 라이브러리 목록 (CVE는 S5에서 별도 조회) */
  sca?: { libraries: SastScaLibrary[] } | null;
  error?: string;
  errorDetail?: SastScanErrorDetail;
}

/** 빌드 타겟 탐색 응답 */
/** S4 POST /v1/build 응답 */
export interface BuildResponse {
  success: boolean;
  compileCommandsPath?: string;
  entries?: number;
  elapsedMs?: number;
  error?: string;
  buildLog?: string;
  failureCategory?: string;
  environmentKeys?: string[];
}

export interface DiscoverTargetsResponse {
  targets: Array<{
    name: string;
    relativePath: string;
    buildSystem: string;
    buildFile: string;
  }>;
  elapsedMs: number;
}

// ── 클라이언트 ──

export class SastClient {
  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_BASE_MS = 2000;

  constructor(private baseUrl: string) {}

  async scan(
    request: SastScanRequest,
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<SastScanResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (requestId) headers["X-Request-Id"] = requestId;

    const data = await this.doScanFetch(
      `${this.baseUrl}/v1/scan`,
      headers,
      request,
      requestId,
      signal,
    );

    if (data.status === "completed") {
      logger.info(
        {
          scanId: data.scanId,
          findingsTotal: data.stats.findingsTotal,
          elapsedMs: data.stats.elapsedMs,
          toolsRun: data.execution.toolsRun,
          requestId,
        },
        "SAST scan completed",
      );
    } else {
      logger.warn(
        { scanId: data.scanId, error: data.error, errorCode: data.errorDetail?.code, requestId },
        "SAST scan failed",
      );
    }

    return data;
  }

  async build(
    request: {
      projectPath: string;
      buildCommand: string;
      buildEnvironment?: Record<string, string>;
      provenance?: {
        buildSnapshotId?: string;
        buildUnitId?: string;
        snapshotSchemaVersion?: string;
      };
      wrapWithBear?: boolean;
    },
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<BuildResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (requestId) headers["X-Request-Id"] = requestId;

    const res = await this.doFetch(
      `${this.baseUrl}/v1/build`,
      headers,
      request,
      requestId,
      signal,
    );

    try {
      const data = (await res.json()) as {
        success: boolean;
        buildEvidence?: {
          compileCommandsPath?: string;
          entries?: number;
          userEntries?: number;
          elapsedMs?: number;
          buildOutput?: string;
          environmentKeys?: string[];
        };
        failureDetail?: {
          category?: string;
          summary?: string;
          matchedExcerpt?: string;
        };
        compileCommandsPath?: string;
        entries?: number;
        elapsedMs?: number;
        error?: string;
        buildLog?: string;
      };
      const evidence = data.buildEvidence;
      return {
        success: data.success,
        compileCommandsPath: evidence?.compileCommandsPath ?? data.compileCommandsPath,
        entries: evidence?.userEntries ?? evidence?.entries ?? data.entries,
        elapsedMs: evidence?.elapsedMs ?? data.elapsedMs,
        buildLog: evidence?.buildOutput ?? data.buildLog,
        error: data.error ?? data.failureDetail?.summary ?? data.failureDetail?.matchedExcerpt,
        failureCategory: data.failureDetail?.category,
        environmentKeys: evidence?.environmentKeys,
      };
    } catch (err) {
      throw new SastUnavailableError("Failed to parse build response", err);
    }
  }

  async discoverTargets(
    projectPath: string,
    requestId?: string,
  ): Promise<DiscoverTargetsResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (requestId) headers["X-Request-Id"] = requestId;

    const res = await this.doFetch(
      `${this.baseUrl}/v1/discover-targets`,
      headers,
      { projectPath },
      requestId,
    );

    try {
      return (await res.json()) as DiscoverTargetsResponse;
    } catch (err) {
      throw new SastUnavailableError("Failed to parse discover-targets response", err);
    }
  }

  async identifyLibraries(
    projectPath: string,
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<Array<{ name: string; version?: string; path: string; modifiedFiles?: string[] }>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (requestId) headers["X-Request-Id"] = requestId;

    try {
      const res = await this.doFetch(
        `${this.baseUrl}/v1/libraries`,
        headers,
        { projectPath },
        requestId,
        signal,
      );
      const data = (await res.json()) as { libraries: Array<{ name: string; version?: string; path: string; modifiedFiles?: string[] }> };
      return data.libraries ?? [];
    } catch (err) {
      logger.warn({ err, projectPath, requestId }, "Library identification failed — continuing without");
      return [];
    }
  }

  async checkHealth(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/health`);
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      logger.warn({ err }, "SAST Runner health check failed");
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
        res = await fetch(url, {
          method: "POST",
          headers,
          body: bodyStr,
          signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        const message = err instanceof Error ? err.message : "Network error";
        if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
          throw new SastTimeoutError(`SAST Runner timeout: ${message}`, err);
        }
        throw new SastUnavailableError(
          `SAST Runner unreachable: ${message}`,
          err,
        );
      }

      if (res.status === 503 && attempt < SastClient.MAX_RETRIES) {
        const delay = SastClient.RETRY_BASE_MS * 2 ** attempt;
        logger.warn(
          { attempt: attempt + 1, delayMs: delay, requestId },
          "SAST Runner overloaded (503), retrying",
        );
        await this.sleep(delay, signal);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new SastUnavailableError(
          `SAST Runner returned HTTP ${res.status}: ${text.slice(0, 200)}`,
        );
      }

      return res;
    }
  }

  private async doScanFetch(
    url: string,
    headers: Record<string, string>,
    body: unknown,
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<SastScanResponse> {
    const bodyStr = JSON.stringify(body);

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers,
          body: bodyStr,
          signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        const message = err instanceof Error ? err.message : "Network error";
        if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
          throw new SastTimeoutError(`SAST Runner timeout: ${message}`, err);
        }
        throw new SastUnavailableError(`SAST Runner unreachable: ${message}`, err);
      }

      if (res.status === 503) {
        const text = await res.text().catch(() => "");
        const failure = this.tryParseScanFailure(text);
        if (failure) {
          return failure;
        }
        if (attempt < SastClient.MAX_RETRIES) {
          const delay = SastClient.RETRY_BASE_MS * 2 ** attempt;
          logger.warn(
            { attempt: attempt + 1, delayMs: delay, requestId },
            "SAST Runner overloaded (503), retrying",
          );
          await this.sleep(delay, signal);
          continue;
        }
        throw new SastUnavailableError(
          `SAST Runner returned HTTP 503: ${text.slice(0, 200)}`,
        );
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new SastUnavailableError(
          `SAST Runner returned HTTP ${res.status}: ${text.slice(0, 200)}`,
        );
      }

      try {
        return (await res.json()) as SastScanResponse;
      } catch (err) {
        throw new SastUnavailableError(
          "Failed to parse SAST Runner response as JSON",
          err,
        );
      }
    }
  }

  private tryParseScanFailure(text: string): SastScanResponse | null {
    if (!text) return null;
    try {
      const parsed = JSON.parse(text) as Partial<SastScanResponse>;
      if (parsed.success === false && parsed.status === "failed") {
        return {
          success: false,
          scanId: parsed.scanId ?? "",
          status: "failed",
          findings: Array.isArray(parsed.findings) ? parsed.findings : [],
          stats: parsed.stats ?? {
            filesScanned: 0,
            rulesRun: 0,
            findingsTotal: 0,
            elapsedMs: 0,
          },
          execution: parsed.execution ?? {
            toolsRun: [],
            toolResults: {},
          },
          codeGraph: parsed.codeGraph ?? null,
          sca: parsed.sca ?? null,
          error: parsed.error,
          errorDetail: parsed.errorDetail,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        "abort",
        () => { clearTimeout(timer); reject(signal.reason); },
        { once: true },
      );
    });
  }
}
