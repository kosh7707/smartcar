/**
 * v0 LlmClient → v1 TaskAPI 어댑터
 *
 * 기존 서비스(StaticAnalysis, DynamicAnalysis, DynamicTest)가 사용하던
 * v0 analyze() 시그니처를 유지하면서 내부적으로 v1 TaskRequest/TaskResponse로 변환.
 */
import crypto from "crypto";
import { createLogger } from "../lib/logger";
import type {
  LlmTaskClient,
  TaskType,
  TaskRequest,
  TaskEvidenceRef,
  TaskResponseSuccess,
  TaskResponseFailure,
} from "./llm-task-client";

const logger = createLogger("llm-v1-adapter");

// ── v0 호환 타입 (기존 LlmClient에서 이식) ──

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

// ── v0 module → v1 taskType 매핑 ──

const MODULE_TO_TASK_TYPE: Record<string, TaskType> = {
  static_analysis: "static-explain",
  dynamic_analysis: "dynamic-annotate",
  dynamic_testing: "test-plan-propose",
};

// ── 어댑터 ──

export class LlmV1Adapter {
  private queue: Array<{ run: () => void }> = [];
  private running = 0;
  private concurrency: number;

  constructor(private client: LlmTaskClient, concurrency = 1) {
    this.concurrency = concurrency;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        this.running++;
        fn().then(resolve, reject).finally(() => {
          this.running--;
          const next = this.queue.shift();
          if (next) next.run();
        });
      };
      if (this.running < this.concurrency) {
        run();
      } else {
        this.queue.push({ run });
        logger.info(
          { queueSize: this.queue.length },
          "LLM request queued (concurrency=%d)",
          this.concurrency,
        );
      }
    });
  }

  // ── v0 호환 시그니처 ──

  async analyze(
    request: LlmAnalyzeRequest,
    baseUrl?: string,
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<LlmAnalyzeResponse> {
    return this.enqueue(() =>
      this.doAnalyze(request, baseUrl, requestId, signal),
    );
  }

  async checkHealth(baseUrl?: string): Promise<Record<string, unknown> | null> {
    return this.client.checkHealth(baseUrl);
  }

  // ── 내부 변환 ──

  private async doAnalyze(
    request: LlmAnalyzeRequest,
    baseUrl?: string,
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<LlmAnalyzeResponse> {
    const taskType = MODULE_TO_TASK_TYPE[request.module];
    if (!taskType) {
      return {
        success: false,
        vulnerabilities: [],
        error: `Unknown module: ${request.module}`,
      };
    }

    const taskId = crypto.randomUUID();
    const evidenceRefs = this.buildEvidenceRefs(request);

    const taskRequest: TaskRequest = {
      taskType,
      taskId,
      context: this.buildContext(taskType, request),
      evidenceRefs,
      ...(request.maxTokens
        ? { constraints: { maxTokens: request.maxTokens } }
        : {}),
    };

    const response = await this.client.submitTask(taskRequest, requestId, {
      signal,
      baseUrl,
    });

    return this.toV0Response(response);
  }

  private buildContext(taskType: TaskType, request: LlmAnalyzeRequest) {
    if (taskType === "static-explain") {
      return {
        trusted: {
          ...(request.ruleResults?.length
            ? { finding: request.ruleResults[0] }
            : {}),
        },
        untrusted: {
          ...(request.sourceCode ? { sourceSnippet: request.sourceCode } : {}),
        },
      };
    }

    // dynamic-annotate, test-plan-propose, etc.
    return {
      trusted: {
        ...(request.ruleResults ? { ruleMatches: request.ruleResults } : {}),
      },
      untrusted: {
        ...(request.sourceCode ? { sourceCode: request.sourceCode } : {}),
        ...(request.canLog ? { rawCanLog: request.canLog } : {}),
        ...(request.testResults ? { testResults: request.testResults } : {}),
      },
    };
  }

  private buildEvidenceRefs(request: LlmAnalyzeRequest): TaskEvidenceRef[] {
    const refs: TaskEvidenceRef[] = [];

    if (request.sourceCode) {
      refs.push({
        refId: crypto.randomUUID(),
        artifactId: crypto.randomUUID(),
        artifactType: "raw-source",
        locatorType: "snippetRange",
        locator: {},
      });
    }

    if (request.canLog) {
      refs.push({
        refId: crypto.randomUUID(),
        artifactId: crypto.randomUUID(),
        artifactType: "raw-can-window",
        locatorType: "frameWindow",
        locator: {},
      });
    }

    if (request.testResults) {
      refs.push({
        refId: crypto.randomUUID(),
        artifactId: crypto.randomUUID(),
        artifactType: "test-result",
        locatorType: "requestResponsePair",
        locator: {},
      });
    }

    if (request.ruleResults) {
      for (const rule of request.ruleResults) {
        refs.push({
          refId: crypto.randomUUID(),
          artifactId: crypto.randomUUID(),
          artifactType: "rule-match",
          locatorType: "jsonPointer",
          locator: { ruleId: rule.ruleId },
        });
      }
    }

    return refs;
  }

  private toV0Response(response: TaskResponseSuccess | TaskResponseFailure): LlmAnalyzeResponse {
    if (response.status !== "completed") {
      const fail = response as TaskResponseFailure;
      return {
        success: false,
        vulnerabilities: [],
        error: `[${fail.failureCode}] ${fail.failureDetail}`,
      };
    }

    const success = response as TaskResponseSuccess;
    const { result } = success;

    const vulnerabilities: LlmVulnerability[] = result.claims.map((claim) => ({
      severity: result.suggestedSeverity ?? "medium",
      title: claim.statement.slice(0, 200),
      description: claim.statement,
      location: null,
      suggestion: result.recommendedNextSteps[0] ?? null,
      fixCode: null,
    }));

    return {
      success: true,
      vulnerabilities,
      ...(result.caveats.length > 0
        ? { note: result.caveats.join("; ") }
        : {}),
    };
  }
}
