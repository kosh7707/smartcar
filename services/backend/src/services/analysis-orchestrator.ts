/**
 * Quick → Deep 2단계 분석 오케스트레이터
 *
 * Quick: S4 SAST Runner (빌드 + 6도구, ~30초)
 * Deep:  S3 Analysis Agent (SAST + 코드그래프 + SCA + LLM, ~3분)
 */
import crypto from "crypto";
import type {
  AnalysisResult,
  Vulnerability,
  AnalysisSummary,
  Severity,
  SastFinding,
  WsAnalysisMessage,
} from "@aegis/shared";
import { createLogger } from "../lib/logger";
import { NotFoundError } from "../lib/errors";
import type { ProjectSourceService } from "./project-source.service";
import type { SastClient, SastScanResponse } from "./sast-client";
import type {
  AgentClient,
  AgentTaskRequest,
  AgentEvidenceRef,
  AgentResponseSuccess,
} from "./agent-client";
import type { IAnalysisResultDAO } from "../dao/interfaces";
import type { ProjectSettingsService } from "./project-settings.service";
import type { ResultNormalizer, NormalizerContext } from "./result-normalizer";
import type { WsBroadcaster } from "./ws-broadcaster";

const logger = createLogger("analysis-orchestrator");

export class AnalysisOrchestrator {
  constructor(
    private sourceService: ProjectSourceService,
    private sastClient: SastClient,
    private agentClient: AgentClient,
    private analysisResultDAO: IAnalysisResultDAO,
    private settingsService: ProjectSettingsService,
    private resultNormalizer: ResultNormalizer,
    private ws?: WsBroadcaster<WsAnalysisMessage>,
  ) {}

  async runAnalysis(
    projectId: string,
    analysisId: string,
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const projectPath = this.sourceService.getProjectPath(projectId);
    if (!projectPath) {
      throw new NotFoundError(`Project source not found. Upload source first: ${projectId}`);
    }

    const settings = this.settingsService.getAll(projectId);
    const buildProfile = settings.buildProfile;
    const files = this.sourceService.listFiles(projectId);
    if (files.length === 0) {
      throw new NotFoundError("No C/C++ source files found in project");
    }

    const startedAt = new Date().toISOString();

    // ── Phase Quick: S4 SAST ──
    this.broadcast(analysisId, {
      type: "analysis-progress",
      payload: { analysisId, phase: "quick_sast", message: `SAST 스캔 시작 (${files.length}개 파일)` },
    });

    let quickResult: AnalysisResult | undefined;
    let sastFindings: SastFinding[] = [];

    try {
      const scanId = `scan-${crypto.randomUUID().slice(0, 8)}`;
      const sastResponse = await this.sastClient.scan(
        {
          scanId,
          projectId,
          projectPath,
          buildProfile,
        },
        requestId,
        signal,
      );

      sastFindings = sastResponse.findings;
      quickResult = this.buildQuickResult(analysisId, projectId, sastResponse, startedAt);
      this.analysisResultDAO.save(quickResult);

      // Quick 정규화 (기존 normalizeAnalysisResult 재사용 — module: static_analysis, source: rule)
      this.resultNormalizer.normalizeAnalysisResult(quickResult, { startedAt });

      this.broadcast(analysisId, {
        type: "analysis-quick-complete",
        payload: { analysisId, findingCount: sastResponse.stats.findingsTotal },
      });

      logger.info({
        analysisId,
        findingsTotal: sastResponse.stats.findingsTotal,
        elapsedMs: sastResponse.stats.elapsedMs,
        requestId,
      }, "Quick phase completed");
    } catch (err) {
      logger.error({ err, analysisId, requestId }, "Quick phase failed");
      this.broadcast(analysisId, {
        type: "analysis-error",
        payload: {
          analysisId,
          phase: "quick",
          error: err instanceof Error ? err.message : "SAST scan failed",
          retryable: true,
        },
      });
      // Quick 실패해도 Deep은 시도 (SAST findings 없이)
    }

    if (signal?.aborted) return;

    // ── Phase Deep: S3 Agent ──
    this.broadcast(analysisId, {
      type: "analysis-progress",
      payload: { analysisId, phase: "deep_submitting", message: "심층 분석 에이전트 호출 중..." },
    });

    try {
      // 파일 내용 읽기 (Agent에 전달)
      const fileContents = files.map(f => ({
        path: f.relativePath,
        content: this.sourceService.readFile(projectId, f.relativePath),
      }));

      // EvidenceRef 빌드
      const evidenceRefs: AgentEvidenceRef[] = fileContents.map((f, i) => ({
        refId: `eref-file-${i.toString().padStart(2, "0")}`,
        artifactId: `${projectId}:${f.path}`,
        artifactType: "raw-source",
        locatorType: "lineRange",
        locator: {
          file: f.path,
          fromLine: 1,
          toLine: f.content.split("\n").length,
        },
      }));

      const agentRequest: AgentTaskRequest = {
        taskType: "deep-analyze",
        taskId: `deep-${analysisId}`,
        context: {
          trusted: {
            objective: `${projectId} 보안 취약점 심층 분석`,
            files: fileContents,
            projectId,
            projectPath,
            buildProfile,
            sastFindings,
          },
        },
        evidenceRefs,
        constraints: { maxTokens: 4096, timeoutMs: 300000 },
      };

      this.broadcast(analysisId, {
        type: "analysis-progress",
        payload: { analysisId, phase: "deep_analyzing", message: "에이전트가 분석 중... (SAST + 코드그래프 + SCA + LLM)" },
      });

      const agentResponse = await this.agentClient.submitTask(
        agentRequest,
        requestId,
        signal,
      );

      if (this.agentClient.isSuccess(agentResponse)) {
        const deepResult = this.buildDeepResult(
          `deep-${analysisId}`,
          projectId,
          agentResponse,
          startedAt,
        );
        this.analysisResultDAO.save(deepResult);

        // Deep 정규화
        const ctx: NormalizerContext = {
          startedAt,
          agentEvidenceRefs: evidenceRefs,
        };
        this.resultNormalizer.normalizeAgentResult(deepResult, agentResponse, ctx);

        this.broadcast(analysisId, {
          type: "analysis-deep-complete",
          payload: { analysisId, findingCount: agentResponse.result.claims.length },
        });

        logger.info({
          analysisId,
          claimCount: agentResponse.result.claims.length,
          confidence: agentResponse.result.confidence,
          latencyMs: agentResponse.audit.latencyMs,
          requestId,
        }, "Deep phase completed");
      } else {
        // Agent 실패
        const failedResult: AnalysisResult = {
          id: `deep-${analysisId}`,
          projectId,
          module: "deep_analysis",
          status: "failed",
          vulnerabilities: [],
          summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          warnings: [{
            code: agentResponse.failureCode,
            message: agentResponse.failureDetail,
          }],
          createdAt: startedAt,
        };
        this.analysisResultDAO.save(failedResult);

        this.broadcast(analysisId, {
          type: "analysis-error",
          payload: {
            analysisId,
            phase: "deep",
            error: `[${agentResponse.failureCode}] ${agentResponse.failureDetail}`,
            retryable: agentResponse.retryable ?? false,
          },
        });

        logger.warn({
          analysisId,
          failureCode: agentResponse.failureCode,
          retryable: agentResponse.retryable,
          requestId,
        }, "Deep phase failed: %s", agentResponse.failureDetail);
      }
    } catch (err) {
      logger.error({ err, analysisId, requestId }, "Deep phase error");
      this.broadcast(analysisId, {
        type: "analysis-error",
        payload: {
          analysisId,
          phase: "deep",
          error: err instanceof Error ? err.message : "Agent call failed",
          retryable: true,
        },
      });
    }
  }

  private buildQuickResult(
    analysisId: string,
    projectId: string,
    sastResponse: SastScanResponse,
    startedAt: string,
  ): AnalysisResult {
    const vulns: Vulnerability[] = sastResponse.findings.map((f, i) => ({
      id: `VULN-SAST-${Date.now()}-${i}`,
      severity: this.normalizeSastSeverity(f.severity),
      title: f.message.length > 120 ? f.message.slice(0, 117) + "..." : f.message,
      description: `[${f.toolId}] ${f.message}`,
      location: `${f.location.file}:${f.location.line}`,
      source: "rule" as const,
      ruleId: f.ruleId,
    }));

    const summary = this.computeSummary(vulns);

    return {
      id: analysisId,
      projectId,
      module: "static_analysis",
      status: "completed",
      vulnerabilities: vulns,
      summary,
      createdAt: startedAt,
    };
  }

  private buildDeepResult(
    deepId: string,
    projectId: string,
    agentResponse: AgentResponseSuccess,
    startedAt: string,
  ): AnalysisResult {
    const assessment = agentResponse.result;
    const severity = this.validateSeverity(assessment.suggestedSeverity);

    const vulns: Vulnerability[] = assessment.claims.map((claim, i) => ({
      id: `VULN-AGENT-${Date.now()}-${i}`,
      severity,
      title: this.extractTitle(claim.statement),
      description: claim.statement,
      location: claim.location ?? undefined,
      source: "llm" as const,
      suggestion: assessment.recommendedNextSteps[i] ?? assessment.recommendedNextSteps[0],
    }));

    const summary = this.computeSummary(vulns);

    return {
      id: deepId,
      projectId,
      module: "deep_analysis",
      status: "completed",
      vulnerabilities: vulns,
      summary,
      createdAt: startedAt,
    };
  }

  private normalizeSastSeverity(toolSeverity: string): Severity {
    const lower = toolSeverity.toLowerCase();
    if (lower === "error" || lower === "critical") return "critical";
    if (lower === "warning" || lower === "high") return "high";
    if (lower === "style" || lower === "medium") return "medium";
    if (lower === "info" || lower === "low") return "low";
    return "medium";
  }

  private validateSeverity(severity?: string | null): Severity {
    const valid = new Set(["critical", "high", "medium", "low", "info"]);
    if (severity && valid.has(severity)) return severity as Severity;
    return "medium";
  }

  private extractTitle(statement: string): string {
    const firstSentence = statement.split(/[.。]/)[0] ?? statement;
    return firstSentence.length > 120
      ? firstSentence.slice(0, 117) + "..."
      : firstSentence;
  }

  private computeSummary(vulns: Vulnerability[]): AnalysisSummary {
    const summary: AnalysisSummary = { total: vulns.length, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const v of vulns) summary[v.severity]++;
    return summary;
  }

  private broadcast(analysisId: string, msg: WsAnalysisMessage): void {
    this.ws?.broadcast(analysisId, msg);
  }
}
