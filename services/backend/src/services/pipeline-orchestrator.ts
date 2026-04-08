/**
 * 서브 프로젝트 파이프라인 오케스트레이터
 *
 * 빌드(S4) → 스캔(S4) → 코드그래프 적재(S5) 순차 실행
 * 서브 프로젝트(BuildTarget)별로 상태머신 관리 + WS 진행률 브로드캐스트
 */
import crypto from "crypto";
import path from "path";
import type {
  BuildTarget,
  BuildTargetStatus,
  WsPipelineMessage,
  AnalysisResult,
  Vulnerability,
  Severity,
} from "@aegis/shared";
import type { PipelinePhase } from "@aegis/shared";
import { createLogger } from "../lib/logger";
import { NotFoundError, BuildAgentUnavailableError, BuildAgentTimeoutError, PipelineStepError } from "../lib/errors";
import type { ProjectSourceService } from "./project-source.service";
import type { SastClient, SastScanResponse } from "./sast-client";
import type { KbClient } from "./kb-client";
import type { BuildAgentClient } from "./build-agent-client";
import type { TargetLibraryDAO } from "../dao/target-library.dao";
import type { IBuildTargetDAO, IAnalysisResultDAO } from "../dao/interfaces";
import type { ResultNormalizer } from "./result-normalizer";
import type { WsBroadcaster } from "./ws-broadcaster";
import type { NotificationService } from "./notification.service";

const logger = createLogger("pipeline-orchestrator");

const SETUP_STATUSES: readonly string[] = ["discovered", "resolving", "configured", "resolve_failed"];

function statusToPhase(status: BuildTargetStatus): PipelinePhase {
  if (SETUP_STATUSES.includes(status)) return "setup";
  if (status === "ready") return "ready";
  return "build";
}

export class PipelineOrchestrator {
  constructor(
    private sourceService: ProjectSourceService,
    private sastClient: SastClient,
    private kbClient: KbClient,
    private buildAgentClient: BuildAgentClient,
    private targetLibraryDAO: TargetLibraryDAO,
    private buildTargetDAO: IBuildTargetDAO,
    private analysisResultDAO: IAnalysisResultDAO,
    private resultNormalizer: ResultNormalizer,
    private ws?: WsBroadcaster<WsPipelineMessage>,
    private notificationService?: NotificationService,
  ) {}

  async runPipeline(
    projectId: string,
    targetIds?: string[],
    requestId?: string,
    signal?: AbortSignal,
    pipelineId: string = `pipe-${crypto.randomUUID().slice(0, 8)}`,
  ): Promise<void> {
    const projectPath = this.sourceService.getProjectPath(projectId);
    if (!projectPath) {
      throw new NotFoundError(`Project source not found: ${projectId}`);
    }

    let targets = this.buildTargetDAO.findByProjectId(projectId);
    if (targetIds?.length) {
      targets = targets.filter((t) => targetIds.includes(t.id));
    }
    if (targets.length === 0) {
      throw new NotFoundError("No build targets found for this project");
    }

    let readyCount = 0;
    let failedCount = 0;

    for (const target of targets) {
      if (signal?.aborted) break;

      try {
        await this.processTarget(projectId, pipelineId, projectPath, target, requestId, signal);
        readyCount++;
      } catch (err) {
        failedCount++;
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        logger.error({ err, targetId: target.id, targetName: target.name, requestId }, "Pipeline target failed");

        this.broadcast(projectId, {
          type: "pipeline-error",
          payload: {
            pipelineId,
            projectId,
            targetId: target.id,
            targetName: target.name,
            phase: "build",
            error: errorMsg,
          },
        });
      }
    }

    this.broadcast(projectId, {
      type: "pipeline-complete",
      payload: { pipelineId, projectId, readyCount, failedCount, totalCount: targets.length },
    });
    this.emitTerminalNotification(projectId, pipelineId, readyCount, failedCount, targets.length);

    logger.info({ pipelineId, projectId, readyCount, failedCount, total: targets.length, requestId }, "Pipeline completed");
  }

  private async processTarget(
    projectId: string,
    pipelineId: string,
    projectPath: string,
    target: BuildTarget,
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    // 격리된 서브프로젝트 경로 우선 사용 (없으면 원본 프로젝트 내 상대경로)
    const scanPath = target.sourcePath ?? path.join(projectPath, target.relativePath);
    const isIsolated = !!target.sourcePath;
    const kbProjectId = `${projectId}:${target.name}`;

    // ── Step 0: Build Resolve (S3 Build Agent) ──
    if (target.status === "discovered" || !target.buildCommand) {
      this.updateStatus(projectId, pipelineId, target, "resolving", "빌드 명령어 자동 탐색 중 (Build Agent)...");

      try {
        let resolveResp = await this.buildAgentClient.submitTask(
          {
            taskType: "build-resolve",
            taskId: `resolve-${crypto.randomUUID().slice(0, 8)}`,
            context: {
              trusted: {
                projectPath: scanPath,
                targetPath: isIsolated ? "." : target.relativePath,
                targetName: target.name,
                targets: [
                  {
                    name: target.name,
                    path: isIsolated ? "." : target.relativePath,
                    buildSystem: target.buildSystem ?? "cmake",
                    buildFiles: [],
                  },
                ],
              },
            },
            constraints: { timeoutMs: 600_000 },
          },
          requestId,
          signal,
        );

        // 재시도: retryable 실패 시 1회 자동 재시도
        if (!this.buildAgentClient.isSuccess(resolveResp) && resolveResp.retryable && !signal?.aborted) {
          logger.info({ targetId: target.id, failureCode: resolveResp.failureCode }, "Retryable build failure, attempting retry (1/1)");
          this.updateStatus(projectId, pipelineId, target, "resolving", "빌드 재시도 중...");
          resolveResp = await this.buildAgentClient.submitTask(
            { taskType: "build-resolve", taskId: `resolve-retry-${crypto.randomUUID().slice(0, 8)}`,
              context: { trusted: { projectPath: scanPath, targetPath: isIsolated ? "." : target.relativePath, targetName: target.name,
                targets: [{ name: target.name, path: isIsolated ? "." : target.relativePath, buildSystem: target.buildSystem ?? "cmake", buildFiles: [] }] } },
              constraints: { timeoutMs: 600_000 } }, requestId, signal);
        }

        if (this.buildAgentClient.isSuccess(resolveResp)) {
          const br = resolveResp.result.buildResult;

          if (!br.success) {
            // 에이전트가 빌드 시도했지만 실패
            this.buildTargetDAO.updatePipelineState(target.id, {
              status: "resolve_failed",
              buildLog: br.errorLog ?? undefined,
            });
            this.updateStatus(projectId, pipelineId, target, "resolve_failed", `빌드 실패: ${br.errorLog ?? "unknown"}`);
            if (!target.buildProfile?.compiler) {
              throw new PipelineStepError(`Build resolve failed for ${target.name}: ${br.errorLog}`);
            }
            logger.warn({ targetId: target.id }, "Build Agent build failed, using existing profile");
          } else {
            // 빌드 성공 — buildCommand + buildScript 저장
            this.buildTargetDAO.updatePipelineState(target.id, {
              status: "configured",
              buildCommand: br.buildCommand,
            });
            target.buildCommand = br.buildCommand;
            this.updateStatus(
              projectId,
              pipelineId,
              target,
              "configured",
              `빌드 명령어 결정 완료 (confidence: ${resolveResp.result.confidence})`,
            );
          }
        } else {
          this.buildTargetDAO.updatePipelineState(target.id, { status: "resolve_failed" });
          this.updateStatus(projectId, pipelineId, target, "resolve_failed", resolveResp.failureDetail);
          if (!target.buildProfile?.compiler) {
            throw new PipelineStepError(`Build resolve failed for ${target.name}: ${resolveResp.failureDetail}`);
          }
          logger.warn({ targetId: target.id }, "Build resolve failed, using existing profile");
        }
      } catch (err) {
        if (err instanceof BuildAgentUnavailableError || err instanceof BuildAgentTimeoutError) {
          logger.warn({ err, targetId: target.id }, "Build Agent unavailable, using existing profile");
          if (!target.buildProfile?.compiler) {
            this.buildTargetDAO.updatePipelineState(target.id, { status: "resolve_failed" });
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    if (signal?.aborted) return;

    if (!target.buildCommand) {
      this.buildTargetDAO.updatePipelineState(target.id, { status: "resolve_failed" });
      this.updateStatus(projectId, pipelineId, target, "resolve_failed", "빌드 명령어 없음 — caller-materialized buildCommand 필요");
      throw new PipelineStepError(`Build command missing for ${target.name}`);
    }

    // ── Step 1: Build ──
    this.updateStatus(projectId, pipelineId, target, "building", "빌드 중 (bear → compile_commands.json)...");

    const buildResult = await this.sastClient.build(
      { projectPath: scanPath, buildCommand: target.buildCommand },
      requestId,
      signal,
    );

    if (!buildResult.success) {
      if (buildResult.entries && buildResult.entries > 0 && buildResult.compileCommandsPath) {
        // 부분 빌드 — compile_commands는 있으므로 SAST 진행 가능
        logger.warn(
          { targetId: target.id, entries: buildResult.entries, requestId },
          "Partial build — continuing with partial compile_commands",
        );
        this.buildTargetDAO.updatePipelineState(target.id, {
          status: "built",
          compileCommandsPath: buildResult.compileCommandsPath,
          buildLog: buildResult.buildLog ?? buildResult.error,
          lastBuiltAt: new Date().toISOString(),
        });
        this.updateStatus(projectId, pipelineId, target, "built", `부분 빌드 (${buildResult.entries} entries) — SAST 진행`);
      } else {
        // 완전 실패
        this.buildTargetDAO.updatePipelineState(target.id, {
          status: "build_failed",
          buildLog: buildResult.buildLog ?? buildResult.error,
        });
        this.updateStatus(projectId, pipelineId, target, "build_failed", `빌드 실패: ${buildResult.error}`);
        throw new PipelineStepError(`Build failed for ${target.name}: ${buildResult.error}`);
      }
    } else {
      this.buildTargetDAO.updatePipelineState(target.id, {
        status: "built",
        compileCommandsPath: buildResult.compileCommandsPath,
        lastBuiltAt: new Date().toISOString(),
      });
      this.updateStatus(projectId, pipelineId, target, "built", `빌드 완료 (${buildResult.entries ?? 0} entries)`);
    }

    if (signal?.aborted) return;

    // ── Step 1.5: Library Identification (S4) ──
    let thirdPartyPaths: string[] = [];
    try {
      const libs = await this.sastClient.identifyLibraries(scanPath, requestId, signal);
      if (libs.length > 0) {
        this.targetLibraryDAO.upsertFromScan(target.id, projectId, libs);
        thirdPartyPaths = this.targetLibraryDAO.getIncludedPaths(target.id);
        logger.info({ targetId: target.id, identified: libs.length, included: thirdPartyPaths.length }, "Libraries identified");
      }
    } catch (err) {
      logger.warn({ err, targetId: target.id }, "Library identification failed — continuing without");
    }

    if (signal?.aborted) return;

    // ── Step 2: SAST Scan ──
    this.updateStatus(projectId, pipelineId, target, "scanning", "SAST 스캔 + SCA 진행 중...");

    const scanId = `scan-${crypto.randomUUID().slice(0, 8)}`;
    const sastResponse = await this.sastClient.scan(
      {
        scanId,
        projectId,
        projectPath: scanPath,
        compileCommands: buildResult.compileCommandsPath,
        buildProfile: target.buildProfile,
        thirdPartyPaths: thirdPartyPaths.length > 0 ? thirdPartyPaths : undefined,
      },
      requestId,
      signal,
    );

    if (sastResponse.status !== "completed") {
      this.buildTargetDAO.updatePipelineState(target.id, { status: "scan_failed" });
      this.updateStatus(projectId, pipelineId, target, "scan_failed", `스캔 실패: ${sastResponse.error}`);
      throw new PipelineStepError(`Scan failed for ${target.name}: ${sastResponse.error}`);
    }

    // Quick 결과 저장
    const quickResult = this.buildQuickResult(scanId, projectId, target.name, sastResponse);
    this.analysisResultDAO.save(quickResult);
    this.resultNormalizer.normalizeAnalysisResult(quickResult, { startedAt: new Date().toISOString() });

    this.buildTargetDAO.updatePipelineState(target.id, {
      status: "scanned",
      sastScanId: scanId,
      scaLibraries: sastResponse.sca?.libraries,
    });
    this.updateStatus(projectId, pipelineId, target, "scanned", `스캔 완료 (${sastResponse.stats.findingsTotal} findings)`);

    if (signal?.aborted) return;

    // ── Step 3: Code Graph Ingest ──
    if (sastResponse.codeGraph) {
      // KB degraded 체크 — Neo4j 미연결 시 그래프 적재 스킵
      const kbReady = await this.kbClient.checkReady().catch(() => null);
      if (kbReady?.degraded === true) {
        logger.warn({ targetId: target.id, requestId }, "KB degraded (Neo4j unavailable), skipping code graph ingest");
        this.buildTargetDAO.updatePipelineState(target.id, {
          status: "graphed",
          codeGraphStatus: "skipped_degraded",
        });
        this.updateStatus(projectId, pipelineId, target, "graphed", "코드그래프 스킵 (KB degraded — Neo4j 미연결)");
      } else {
      this.updateStatus(projectId, pipelineId, target, "graphing", "코드그래프 KB 적재 중...");

      try {
        const ingestResult = await this.kbClient.ingestCodeGraph(
          kbProjectId,
          sastResponse.codeGraph,
          requestId,
          signal,
        );

        this.buildTargetDAO.updatePipelineState(target.id, {
          status: "graphed",
          codeGraphStatus: "ingested",
          codeGraphNodeCount: ingestResult.nodes_created,
        });
        this.updateStatus(projectId, pipelineId, target, "graphed", `코드그래프 적재 완료 (${ingestResult.nodes_created} nodes)`);
      } catch (err) {
        // 코드그래프 실패는 치명적이지 않음 — 경고 후 계속
        logger.warn({ err, targetId: target.id, requestId }, "Code graph ingest failed, continuing");
        this.buildTargetDAO.updatePipelineState(target.id, {
          status: "graphed",
          codeGraphStatus: "failed",
        });
      }
      } // end else (not degraded)
    } else {
      this.buildTargetDAO.updatePipelineState(target.id, {
        status: "graphed",
        codeGraphStatus: "pending",
      });
    }

    // ── Step 4: Ready ──
    this.buildTargetDAO.updatePipelineState(target.id, { status: "ready" });
    this.updateStatus(projectId, pipelineId, target, "ready", "분석 준비 완료");
  }

  private buildQuickResult(
    scanId: string,
    projectId: string,
    targetName: string,
    sastResponse: SastScanResponse,
  ): AnalysisResult {
    const vulns: Vulnerability[] = sastResponse.findings.map((f, i) => ({
      id: `VULN-SAST-${Date.now()}-${i}`,
      severity: this.normalizeSeverity(f.severity),
      title: f.message.length > 120 ? f.message.slice(0, 117) + "..." : f.message,
      description: `[${f.toolId}] ${f.message}`,
      location: `${f.location.file}:${f.location.line}`,
      source: "rule" as const,
      ruleId: f.ruleId,
    }));

    const summary = { total: vulns.length, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const v of vulns) summary[v.severity]++;

    return {
      id: scanId,
      projectId,
      module: "static_analysis",
      status: "completed",
      vulnerabilities: vulns,
      summary,
      scaLibraries: sastResponse.sca?.libraries ? [...sastResponse.sca.libraries] : undefined,
      createdAt: new Date().toISOString(),
    };
  }

  private normalizeSeverity(toolSeverity: string): Severity {
    const lower = toolSeverity.toLowerCase();
    if (lower === "error" || lower === "critical") return "critical";
    if (lower === "warning" || lower === "high") return "high";
    if (lower === "style" || lower === "medium") return "medium";
    if (lower === "info" || lower === "low") return "low";
    return "medium";
  }

  private updateStatus(
    projectId: string,
    pipelineId: string,
    target: BuildTarget,
    status: BuildTargetStatus,
    message: string,
  ): void {
    this.broadcast(projectId, {
      type: "pipeline-target-status",
      payload: {
        pipelineId,
        projectId,
        targetId: target.id,
        targetName: target.name,
        status,
        message,
        phase: statusToPhase(status),
      },
    });
  }

  private broadcast(projectId: string, msg: WsPipelineMessage): void {
    this.ws?.broadcast(projectId, msg);
  }

  private emitTerminalNotification(
    projectId: string,
    pipelineId: string,
    readyCount: number,
    failedCount: number,
    totalCount: number,
  ): void {
    try {
      this.notificationService?.emit({
        projectId,
        type: failedCount > 0 ? "gate_failed" : "analysis_complete",
        title: failedCount > 0 ? "파이프라인 완료 (일부 실패)" : "파이프라인 완료",
        body: `ready ${readyCount}/${totalCount}, failed ${failedCount}`,
        jobKind: "pipeline",
        resourceId: pipelineId,
        correlationId: pipelineId,
        severity: failedCount > 0 ? "medium" : "low",
      });
    } catch {
      // notification failure must not affect pipeline completion
    }
  }
}
