/**
 * Quick → Deep 2단계 분석 오케스트레이터
 *
 * Quick: S4 SAST Runner (빌드 + 6도구, ~30초)
 * Deep:  S3 Analysis Agent (SAST + 코드그래프 + SCA + LLM, ~3분)
 */
import crypto from "crypto";
import path from "path";
import type {
  AnalysisResult,
  Vulnerability,
  AnalysisSummary,
  Severity,
  SastFinding,
  BuildProfile,
  BuildTarget,
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
import type { BuildTargetService } from "./build-target.service";
import type { ResultNormalizer, NormalizerContext } from "./result-normalizer";
import type { WsBroadcaster } from "./ws-broadcaster";
import type { TargetLibraryDAO } from "../dao/target-library.dao";
import type { AnalysisTracker } from "./analysis-tracker";

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
    private buildTargetService?: BuildTargetService,
    private targetLibraryDAO?: TargetLibraryDAO,
    private analysisTracker?: AnalysisTracker,
  ) {}

  async runAnalysis(
    projectId: string,
    analysisId: string,
    targetIds?: string[],
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const projectPath = this.sourceService.getProjectPath(projectId);
    if (!projectPath) {
      throw new NotFoundError(`Project source not found. Upload source first: ${projectId}`);
    }

    // 빌드 타겟 조회
    let targets = this.buildTargetService?.findByProjectId(projectId) ?? [];
    if (targetIds?.length) {
      targets = targets.filter((t) => targetIds.includes(t.id));
    }

    if (targets.length > 0) {
      // ── 타겟별 분석 ──
      await this.runAnalysisWithTargets(projectId, analysisId, projectPath, targets, requestId, signal);
    } else {
      // ── 기존 방식 (타겟 없음: 프로젝트 전체) ──
      const settings = this.settingsService.getAll(projectId);
      await this.runSingleAnalysis(projectId, analysisId, projectPath, settings.buildProfile, undefined, requestId, signal);
    }
  }

  /** 타겟별 순차 분석 */
  private async runAnalysisWithTargets(
    projectId: string,
    analysisId: string,
    projectPath: string,
    targets: BuildTarget[],
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    for (const [i, target] of targets.entries()) {
      if (signal?.aborted) return;

      const scanPath = path.join(projectPath, target.relativePath);
      const targetProgress = { current: i + 1, total: targets.length };

      // 서드파티 라이브러리 경로 조회 (S4가 cross-boundary 필터링에 사용)
      const thirdPartyPaths = this.targetLibraryDAO?.getIncludedPaths(target.id) ?? [];

      await this.runSingleAnalysis(
        projectId,
        `${analysisId}-${target.name}`,
        scanPath,
        target.buildProfile,
        { name: target.name, relativePath: target.relativePath, progress: targetProgress },
        requestId,
        signal,
        thirdPartyPaths.length > 0 ? thirdPartyPaths : undefined,
        analysisId,
      );
    }
  }

  /** 단일 경로에 대한 Quick→Deep 분석 */
  private async runSingleAnalysis(
    projectId: string,
    analysisId: string,
    scanPath: string,
    buildProfile: BuildProfile | undefined,
    targetInfo?: { name: string; relativePath: string; progress?: { current: number; total: number } },
    requestId?: string,
    signal?: AbortSignal,
    thirdPartyPaths?: string[],
    wsAnalysisId: string = analysisId,
  ): Promise<void> {
    const prefix = targetInfo ? `[${targetInfo.name}] ` : "";
    const files = this.sourceService.listFiles(projectId);
    const startedAt = new Date().toISOString();

    // ── Phase Quick: S4 SAST ──
    this.analysisTracker?.update(wsAnalysisId, {
      phase: "quick_sast",
      message: `${prefix}SAST 스캔 시작`,
      totalFiles: files.length,
      processedFiles: 0,
    });
    this.broadcast(wsAnalysisId, {
      type: "analysis-progress",
      payload: {
        analysisId: wsAnalysisId, phase: "quick_sast",
        message: `${prefix}SAST 스캔 시작`,
        targetName: targetInfo?.name,
        targetProgress: targetInfo?.progress,
      },
    });

    let sastFindings: SastFinding[] = [];
    let codeGraphSummary: unknown = undefined;
    let scaLibraries: unknown = undefined;

    try {
      const scanId = `scan-${crypto.randomUUID().slice(0, 8)}`;
      const sastResponse = await this.sastClient.scan(
        { scanId, projectId, projectPath: scanPath, buildProfile, thirdPartyPaths },
        requestId,
        signal,
      );

      if (sastResponse.status !== "completed") {
        logger.warn({
          analysisId,
          target: targetInfo?.name,
          requestId,
          error: sastResponse.error,
          errorCode: sastResponse.errorDetail?.code,
        }, "Quick phase returned failed scan response");
        this.broadcast(wsAnalysisId, {
          type: "analysis-error",
          payload: {
            analysisId: wsAnalysisId,
            phase: "quick",
            error: sastResponse.error ?? "SAST scan failed",
            retryable: sastResponse.errorDetail?.retryable === true,
          },
        });
        return;
      }

      sastFindings = sastResponse.findings;
      codeGraphSummary = sastResponse.codeGraph ?? undefined;
      scaLibraries = sastResponse.sca?.libraries ?? undefined;
      const quickResult = this.buildQuickResult(analysisId, projectId, sastResponse, startedAt, scaLibraries);
      this.analysisResultDAO.save(quickResult);
      this.resultNormalizer.normalizeAnalysisResult(quickResult, { startedAt });
      this.analysisTracker?.update(wsAnalysisId, {
        phase: "quick_sast",
        message: `${prefix}Quick 분석 완료`,
        processedFiles: files.length,
      });

      this.broadcast(wsAnalysisId, {
        type: "analysis-quick-complete",
        payload: { analysisId: wsAnalysisId, findingCount: sastResponse.stats.findingsTotal },
      });

      logger.info({
        analysisId, findingsTotal: sastResponse.stats.findingsTotal,
        target: targetInfo?.name, requestId,
      }, "Quick phase completed");
    } catch (err) {
      logger.error({ err, analysisId, target: targetInfo?.name, requestId }, "Quick phase failed");
      this.analysisTracker?.update(wsAnalysisId, {
        phase: "quick_sast",
        message: `${prefix}Quick 분석 실패`,
      });
      this.broadcast(wsAnalysisId, {
        type: "analysis-error",
        payload: {
          analysisId: wsAnalysisId, phase: "quick",
          error: err instanceof Error ? err.message : "SAST scan failed",
          retryable: true,
        },
      });
    }

    if (signal?.aborted) return;

    // ── Phase Deep: S3 Agent ──
    this.analysisTracker?.update(wsAnalysisId, {
      phase: "deep_submitting",
      message: `${prefix}심층 분석 에이전트 호출 중...`,
      totalFiles: files.length,
      processedFiles: files.length,
    });
    this.broadcast(wsAnalysisId, {
      type: "analysis-progress",
      payload: {
        analysisId: wsAnalysisId, phase: "deep_submitting",
        message: `${prefix}심층 분석 에이전트 호출 중...`,
        targetName: targetInfo?.name,
        targetProgress: targetInfo?.progress,
      },
    });

    try {
      const evidenceRefs: AgentEvidenceRef[] = [{
        refId: "eref-project-source",
        artifactId: projectId,
        artifactType: "raw-source",
        locatorType: "lineRange",
        locator: { projectPath: scanPath, fileCount: files.length },
      }];

      const agentRequest: AgentTaskRequest = {
        taskType: "deep-analyze",
        taskId: `deep-${analysisId}`,
        context: {
          trusted: {
            objective: `${projectId} 보안 취약점 심층 분석${targetInfo ? ` (${targetInfo.name})` : ""}`,
            projectId,
            projectPath: scanPath,
            targetPath: targetInfo?.relativePath,
            buildProfile,
            sastFindings,
            codeGraphSummary,
            scaLibraries,
            thirdPartyPaths,
          },
        },
        evidenceRefs,
        constraints: { maxTokens: 4096, timeoutMs: 300000 },
      };

      this.analysisTracker?.update(wsAnalysisId, {
        phase: "deep_analyzing",
        message: `${prefix}에이전트가 분석 중... (SAST + 코드그래프 + SCA + LLM)`,
      });
      this.broadcast(wsAnalysisId, {
        type: "analysis-progress",
        payload: {
          analysisId: wsAnalysisId, phase: "deep_analyzing",
          message: `${prefix}에이전트가 분석 중... (SAST + 코드그래프 + SCA + LLM)`,
          targetName: targetInfo?.name,
          targetProgress: targetInfo?.progress,
        },
      });

      let agentResponse = await this.agentClient.submitTask(agentRequest, requestId, signal);

      // 재시도: retryable 실패 시 1회 자동 재시도
      if (!this.agentClient.isSuccess(agentResponse) && agentResponse.retryable && !signal?.aborted) {
        logger.info({
          analysisId, failureCode: agentResponse.failureCode,
          target: targetInfo?.name, requestId,
        }, "Retryable failure, attempting retry (1/1)");
        this.analysisTracker?.update(wsAnalysisId, {
          phase: "deep_analyzing",
          message: `${prefix}재시도 중...`,
        });

        this.broadcast(wsAnalysisId, {
          type: "analysis-progress",
          payload: { analysisId: wsAnalysisId, phase: "deep_retrying", message: `${prefix}재시도 중...`, targetName: targetInfo?.name },
        });

        agentResponse = await this.agentClient.submitTask(agentRequest, requestId, signal);
      }

      if (this.agentClient.isSuccess(agentResponse)) {
        const deepResult = this.buildDeepResult(`deep-${analysisId}`, projectId, agentResponse, startedAt, scaLibraries);
        this.analysisResultDAO.save(deepResult);

        const ctx: NormalizerContext = { startedAt, agentEvidenceRefs: evidenceRefs };
        this.resultNormalizer.normalizeAgentResult(deepResult, agentResponse, ctx);
        this.analysisTracker?.update(wsAnalysisId, {
          phase: "deep_complete",
          message: `${prefix}심층 분석 완료`,
        });

        this.broadcast(wsAnalysisId, {
          type: "analysis-deep-complete",
          payload: { analysisId: wsAnalysisId, findingCount: agentResponse.result.claims.length },
        });

        logger.info({
          analysisId, claimCount: agentResponse.result.claims.length,
          confidence: agentResponse.result.confidence,
          target: targetInfo?.name, requestId,
        }, "Deep phase completed");
      } else {
        const isPartialFailure = agentResponse.failureCode?.startsWith("llm_failure_partial");
        const failedResult: AnalysisResult = {
          id: `deep-${analysisId}`,
          projectId,
          module: "deep_analysis",
          status: "failed",
          vulnerabilities: [],
          summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          warnings: [
            { code: agentResponse.failureCode, message: agentResponse.failureDetail },
            ...(isPartialFailure ? [{ code: "PARTIAL_FAILURE", message: "LLM 실패로 부분 결과만 생성됨 (도구 결과 기반)" }] : []),
          ],
          createdAt: startedAt,
        };
        this.analysisResultDAO.save(failedResult);
        this.analysisTracker?.update(wsAnalysisId, {
          phase: "deep_analyzing",
          message: `${prefix}심층 분석 실패`,
        });

        this.broadcast(wsAnalysisId, {
          type: "analysis-error",
          payload: {
            analysisId: wsAnalysisId, phase: "deep",
            error: `[${agentResponse.failureCode}] ${agentResponse.failureDetail}`,
            retryable: agentResponse.retryable ?? false,
            partial: isPartialFailure,
          },
        });

        logger.warn({
          analysisId, failureCode: agentResponse.failureCode,
          partial: isPartialFailure,
          target: targetInfo?.name, requestId,
        }, "Deep phase failed: %s", agentResponse.failureDetail);
      }
    } catch (err) {
      logger.error({ err, analysisId, target: targetInfo?.name, requestId }, "Deep phase error");
      this.analysisTracker?.update(wsAnalysisId, {
        phase: "deep_analyzing",
        message: `${prefix}심층 분석 실패`,
      });
      this.broadcast(wsAnalysisId, {
        type: "analysis-error",
        payload: {
          analysisId: wsAnalysisId, phase: "deep",
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
    scaLibraries?: unknown,
  ): AnalysisResult {
    const vulns: Vulnerability[] = sastResponse.findings.map((f, i) => ({
      id: `VULN-SAST-${Date.now()}-${i}`,
      severity: this.normalizeSastSeverity(f.severity),
      title: f.message.length > 120 ? f.message.slice(0, 117) + "..." : f.message,
      description: `[${f.toolId}] ${f.message}`,
      location: `${f.location.file}:${f.location.line}`,
      source: "rule" as const,
      ruleId: f.ruleId,
      cweId: (f.metadata?.cweId as string) ?? undefined,
    }));

    const summary = this.computeSummary(vulns);

    return {
      id: analysisId,
      projectId,
      module: "static_analysis",
      status: "completed",
      vulnerabilities: vulns,
      summary,
      scaLibraries: Array.isArray(scaLibraries) ? scaLibraries : undefined,
      createdAt: startedAt,
    };
  }

  private buildDeepResult(
    deepId: string,
    projectId: string,
    agentResponse: AgentResponseSuccess,
    startedAt: string,
    scaLibraries?: unknown,
  ): AnalysisResult {
    const assessment = agentResponse.result;
    const audit = agentResponse.audit;
    const severity = this.validateSeverity(assessment.suggestedSeverity);

    const vulns: Vulnerability[] = assessment.claims.map((claim, i) => ({
      id: `VULN-AGENT-${Date.now()}-${i}`,
      severity,
      title: this.extractTitle(claim.statement),
      description: claim.statement,
      location: claim.location ?? undefined,
      source: "llm" as const,
      suggestion: assessment.recommendedNextSteps?.join("\n"),
      detail: claim.detail ?? undefined,
      cweId: assessment.policyFlags?.find((f: string) => /^CWE-\d+$/.test(f)) ?? undefined,
    }));

    const summary = this.computeSummary(vulns);

    return {
      id: deepId,
      projectId,
      module: "deep_analysis",
      status: "completed",
      vulnerabilities: vulns,
      summary,
      caveats: assessment.caveats,
      confidenceScore: assessment.confidence,
      confidenceBreakdown: assessment.confidenceBreakdown,
      needsHumanReview: assessment.needsHumanReview,
      recommendedNextSteps: assessment.recommendedNextSteps,
      policyFlags: assessment.policyFlags,
      scaLibraries: Array.isArray(scaLibraries) ? scaLibraries : undefined,
      agentAudit: {
        latencyMs: audit.latencyMs,
        tokenUsage: audit.tokenUsage,
        turnCount: audit.agentAudit?.turn_count,
        toolCallCount: audit.agentAudit?.tool_call_count,
        terminationReason: audit.agentAudit?.termination_reason,
      },
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
