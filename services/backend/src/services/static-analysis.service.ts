import crypto from "crypto";
import type {
  AnalysisResult,
  AnalysisWarning,
  FileCoverageEntry,
  Vulnerability,
  Severity,
} from "@smartcar/shared";
import type { RuleMatch } from "../rules/types";
import type { LlmV1Adapter } from "./llm-v1-adapter";
import { validateLlmSeverity } from "../lib/vulnerability-utils";
import type { IFileStore, IAnalysisResultDAO } from "../dao/interfaces";
import { chunkFiles } from "./chunker";
import type { WsBroadcaster } from "./ws-broadcaster";
import type { RuleService } from "./rule.service";
import type { ProjectSettingsService } from "./project-settings.service";
import type { ResultNormalizer } from "./result-normalizer";
import { createLogger } from "../lib/logger";
import { NotFoundError } from "../lib/errors";
import { mergeAndDedup, computeSummary } from "../lib/vulnerability-utils";
import { analysisTracker } from "./analysis-tracker";
import type { StoredFile } from "../dao/file-store";

const logger = createLogger("static-analysis");

export class StaticAnalysisService {
  constructor(
    private fileStore: IFileStore,
    private analysisResultDAO: IAnalysisResultDAO,
    private ruleService: RuleService,
    private llmClient: LlmV1Adapter,
    private settingsService: ProjectSettingsService,
    private ws?: WsBroadcaster<import("@smartcar/shared").WsStaticMessage>,
    private resultNormalizer?: ResultNormalizer
  ) {}

  async runAnalysis(
    projectId: string,
    fileIds: string[],
    analysisId?: string,
    requestId?: string,
    signal?: AbortSignal
  ): Promise<AnalysisResult> {
    const files = this.fileStore.findByIds(fileIds);
    if (files.length === 0) {
      throw new NotFoundError("No files found for the given IDs");
    }

    const id = analysisId ?? `analysis-${crypto.randomUUID()}`;
    const analysisStartedAt = new Date().toISOString();
    const warnings: AnalysisWarning[] = [];

    const llmUrl = this.settingsService.get(projectId, "llmUrl");
    const buildProfile = this.settingsService.get(projectId, "buildProfile");
    const llmBuildProfile = buildProfile ? {
      languageStandard: buildProfile.languageStandard,
      targetArch: buildProfile.targetArch,
      compiler: buildProfile.compiler,
    } : undefined;

    // 0. phase별 시간 가중치 힌트 (프론트 진행률 계산용)
    this.ws?.broadcast(id, {
      type: "static-progress",
      payload: {
        analysisId: id,
        phase: "queued",
        current: 0,
        total: 0,
        message: "분석 대기 중...",
        phaseWeights: { queued: 5, rule_engine: 5, llm_chunk: 80, merging: 10 },
      },
    });

    // 1. 프로젝트 룰 엔진 빌드 + 실행
    this.sendProgress(id, "rule_engine", 0, 1, "룰 엔진 분석 중...");
    analysisTracker.update(id, { phase: "rule_engine", totalFiles: files.length, message: "룰 엔진 분석 중..." });

    const ruleEngine = this.ruleService.buildRuleEngine(projectId);
    const allRuleMatches: RuleMatch[] = [];
    for (const file of files) {
      const matches = ruleEngine.runAll(file.content, file.path || file.name);
      allRuleMatches.push(...matches);
    }

    const ruleVulns: Vulnerability[] = allRuleMatches.map((m, i) => ({
      id: `VULN-RULE-${Date.now()}-${i}`,
      severity: m.severity,
      title: m.title,
      description: m.description,
      location: m.location,
      source: "rule" as const,
      ruleId: m.ruleId,
      suggestion: m.suggestion,
      fixCode: m.fixCode,
    }));

    this.sendProgress(id, "rule_engine", 1, 1, "룰 엔진 분석 완료");
    analysisTracker.update(id, { phase: "rule_engine", message: "룰 엔진 분석 완료" });

    // 2. 파일 청크 분할
    const { chunks, warnings: chunkWarnings, skippedFiles } = chunkFiles(files);
    warnings.push(...chunkWarnings);

    // 3. 청크별 LLM 분석 (병렬 — LlmV1Adapter의 concurrency queue가 동시 요청 수 제한)
    const allLlmVulns: Vulnerability[] = [];
    const totalChunks = chunks.length;
    let completedChunks = 0;
    let processedFiles = 0;

    this.sendProgress(id, "llm_chunk", 0, totalChunks, `LLM 분석 중... (0/${totalChunks})`);
    analysisTracker.update(id, {
      phase: "llm_chunk",
      currentChunk: 0,
      totalChunks,
      processedFiles: 0,
      message: `LLM 분석 중... (0/${totalChunks})`,
    });

    const chunkTasks = chunks.map((chunk, i) => {
      // 이 청크에 해당하는 파일의 룰 결과만 필터
      const chunkFileNames = new Set(
        chunk.files.map((f) => f.path || f.name)
      );
      const chunkRuleMatches = allRuleMatches.filter((m) => {
        const loc = m.location ?? "";
        return [...chunkFileNames].some((name) => loc.includes(name));
      });

      return this.llmClient.analyze({
        module: "static_analysis",
        sourceCode: chunk.sourceCode,
        ruleResults: chunkRuleMatches.map((m) => ({
          ruleId: m.ruleId,
          title: m.title,
          severity: m.severity,
          location: m.location,
        })),
        buildProfile: llmBuildProfile,
      }, llmUrl, requestId, signal).then((llmRes) => {
        completedChunks++;
        processedFiles += chunk.files.length;
        this.sendProgress(id, "llm_chunk", completedChunks, totalChunks, `LLM 분석 중... (${completedChunks}/${totalChunks})`);
        analysisTracker.update(id, {
          phase: "llm_chunk",
          currentChunk: completedChunks,
          totalChunks,
          processedFiles,
          message: `LLM 분석 중... (${completedChunks}/${totalChunks})`,
        });

        if (llmRes.success) {
          // LLM 응답에 location이 없으면 청크 파일 정보로 fallback
          const chunkFilePaths = chunk.files.map((f) => f.path || f.name);

          const chunkVulns = llmRes.vulnerabilities.map((v, vi) => {
            let location = v.location ?? null;
            if (!location) {
              if (chunkFilePaths.length === 1) {
                // 단일 파일 청크: 해당 파일
                location = chunkFilePaths[0];
              } else {
                // 다중 파일 청크: 제목/설명에서 파일명 매칭 시도
                const text = `${v.title} ${v.description}`;
                const matched = chunkFilePaths.find((fp) => {
                  const fileName = fp.includes("/") ? fp.split("/").pop()! : fp;
                  return text.includes(fileName);
                });
                location = matched ?? chunkFilePaths[0];
              }
            }
            return {
              id: `VULN-LLM-${Date.now()}-${i}-${vi}`,
              severity: validateLlmSeverity(v.severity) as Severity,
              title: v.title,
              description: v.description,
              location,
              source: "llm" as const,
              suggestion: v.suggestion ?? undefined,
              fixCode: v.fixCode ?? undefined,
            };
          });
          allLlmVulns.push(...chunkVulns);

          if (llmRes.note) {
            warnings.push({
              code: "LLM_NOTE",
              message: llmRes.note,
              details: chunk.files.map((f) => f.path || f.name).join(", "),
            });
          }
        } else if (llmRes.error?.includes("INPUT_TOO_LARGE")) {
          warnings.push({
            code: "CHUNK_INPUT_SIZE_EXCEEDED",
            message: `입력 크기 초과로 chunk ${i + 1}/${totalChunks} 건너뜀: ${llmRes.error}`,
            details: chunk.files.map((f) => f.path || f.name).join(", "),
          });
          this.sendWarning(id, "CHUNK_INPUT_SIZE_EXCEEDED", `Chunk ${i + 1} input too large`);
        } else {
          warnings.push({
            code: "LLM_CHUNK_FAILED",
            message: `LLM analysis failed for chunk ${i + 1}/${totalChunks}: ${llmRes.error ?? "unknown error"}`,
            details: chunk.files.map((f) => f.path || f.name).join(", "),
          });
          this.sendWarning(id, "LLM_CHUNK_FAILED", `Chunk ${i + 1} failed`);
        }
      }).catch((err) => {
        completedChunks++;
        // AbortError는 상위 전파
        if (err instanceof Error && err.name === "AbortError") {
          throw err;
        }
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        logger.warn({ err, analysisId: id, chunk: i + 1 }, "LLM chunk analysis failed");
        warnings.push({
          code: "LLM_CHUNK_FAILED",
          message: `LLM request error for chunk ${i + 1}/${totalChunks}: ${errMsg}`,
          details: chunk.files.map((f) => f.path || f.name).join(", "),
        });
        this.sendWarning(id, "LLM_CHUNK_FAILED", `Chunk ${i + 1} error: ${errMsg}`);
      });
    });

    // abort 시 전체 중단은 signal이 개별 요청에 전파되어 처리됨
    await Promise.all(chunkTasks);

    // LLM 분석 완료 알림
    this.sendProgress(id, "llm_chunk", totalChunks, totalChunks, "LLM 분석 완료");
    analysisTracker.update(id, { phase: "llm_chunk", currentChunk: totalChunks, totalChunks, message: "LLM 분석 완료" });

    // 4. 병합 + 중복 제거 + 정렬
    this.sendProgress(id, "merging", 0, 1, "결과 병합 중...");
    analysisTracker.update(id, { phase: "merging", message: "결과 병합 중..." });
    const merged = this.mergeAndSort(ruleVulns, allLlmVulns);
    const summary = computeSummary(merged);
    this.sendProgress(id, "merging", 1, 1, "결과 병합 완료");

    // 5. fileCoverage 빌드
    const fileCoverage = this.buildFileCoverage(files, skippedFiles, merged);

    // 6. 결과 생성 + 저장
    const resultStatus = signal?.aborted ? "aborted" : "completed";
    const result: AnalysisResult = {
      id,
      projectId,
      module: "static_analysis",
      status: resultStatus,
      vulnerabilities: merged,
      summary,
      ...(warnings.length > 0 ? { warnings } : {}),
      analyzedFileIds: fileIds,
      fileCoverage,
      createdAt: new Date().toISOString(),
    };

    this.analysisResultDAO.save(result);
    this.resultNormalizer?.normalizeAnalysisResult(result, {
      analyzedFileIds: fileIds,
      analyzedFiles: files.map((f) => ({ id: f.id, filePath: f.path || f.name })),
      startedAt: analysisStartedAt,
    });

    // 7. 완료 이벤트
    this.sendComplete(id);

    return result;
  }

  // --- WS helpers ---

  private sendProgress(
    analysisId: string,
    phase: "rule_engine" | "llm_chunk" | "merging" | "complete",
    current: number,
    total: number,
    message: string
  ): void {
    this.ws?.broadcast(analysisId, {
      type: "static-progress",
      payload: { analysisId, phase, current, total, message },
    });
  }

  private sendWarning(analysisId: string, code: string, message: string): void {
    this.ws?.broadcast(analysisId, {
      type: "static-warning",
      payload: { analysisId, code, message },
    });
  }

  private sendComplete(analysisId: string): void {
    this.ws?.broadcast(analysisId, {
      type: "static-complete",
      payload: { analysisId },
    });
  }

  // --- fileCoverage 빌드 ---

  private buildFileCoverage(
    files: StoredFile[],
    skippedFiles: Array<{ fileId: string; filePath: string; reason: string }>,
    vulnerabilities: Vulnerability[]
  ): FileCoverageEntry[] {
    // 파일별 finding 수 집계 (location에서 파일명 파싱)
    const findingCountByPath = new Map<string, number>();
    for (const v of vulnerabilities) {
      if (!v.location) continue;
      const colonIdx = v.location.lastIndexOf(":");
      const filePath = colonIdx > 0 ? v.location.substring(0, colonIdx) : v.location;
      findingCountByPath.set(filePath, (findingCountByPath.get(filePath) ?? 0) + 1);
    }

    const coverage: FileCoverageEntry[] = [];

    // 분석된 파일
    for (const file of files) {
      const filePath = file.path || file.name;
      const isSkipped = skippedFiles.some((s) => s.fileId === file.id);
      if (isSkipped) continue;
      coverage.push({
        fileId: file.id,
        filePath,
        status: "analyzed",
        findingCount: findingCountByPath.get(filePath) ?? 0,
      });
    }

    // 스킵된 파일
    for (const skipped of skippedFiles) {
      coverage.push({
        fileId: skipped.fileId,
        filePath: skipped.filePath,
        status: "skipped",
        skipReason: skipped.reason,
        findingCount: 0,
      });
    }

    return coverage;
  }

  // --- 기존 로직 ---

  private mergeAndSort(
    ruleVulns: Vulnerability[],
    llmVulns: Vulnerability[]
  ): Vulnerability[] {
    return mergeAndDedup(ruleVulns, llmVulns);
  }

}
