import crypto from "crypto";
import type {
  AnalysisResult,
  AnalysisWarning,
  Vulnerability,
  AnalysisSummary,
  Severity,
} from "@smartcar/shared";
import type { RuleMatch } from "../rules/types";
import { LlmClient, validateLlmSeverity } from "./llm-client";
import { fileStore } from "../dao/file-store";
import { analysisResultDAO } from "../dao/analysis-result.dao";
import { chunkFiles } from "./chunker";
import type { WsManager } from "./ws-manager";
import type { RuleService } from "./rule.service";
import type { ProjectSettingsService } from "./project-settings.service";
import { createLogger } from "../lib/logger";
import { NotFoundError } from "../lib/errors";

const logger = createLogger("static-analysis");

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export class StaticAnalysisService {
  constructor(
    private ruleService: RuleService,
    private llmClient: LlmClient,
    private settingsService: ProjectSettingsService,
    private wsManager?: WsManager
  ) {}

  async runAnalysis(
    projectId: string,
    fileIds: string[],
    analysisId?: string,
    requestId?: string
  ): Promise<AnalysisResult> {
    const files = fileStore.findByIds(fileIds);
    if (files.length === 0) {
      throw new NotFoundError("No files found for the given IDs");
    }

    const id = analysisId ?? `analysis-${crypto.randomUUID()}`;
    const warnings: AnalysisWarning[] = [];

    const llmUrl = this.settingsService.get(projectId, "llmUrl");

    // 1. 프로젝트 룰 엔진 빌드 + 실행
    this.sendProgress(id, "rule_engine", 0, 1, "룰 엔진 분석 중...");

    const ruleEngine = this.ruleService.buildRuleEngine(projectId);
    const allRuleMatches: RuleMatch[] = [];
    for (const file of files) {
      const matches = ruleEngine.runAll(file.content, file.name);
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

    // 2. 파일 청크 분할
    const { chunks, warnings: chunkWarnings } = chunkFiles(files);
    warnings.push(...chunkWarnings);

    // 3. 청크별 LLM 분석
    const allLlmVulns: Vulnerability[] = [];
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks[i];
      this.sendProgress(
        id,
        "llm_chunk",
        i,
        totalChunks,
        `LLM 분석 중... (${i + 1}/${totalChunks})`
      );

      // 이 청크에 해당하는 파일의 룰 결과만 필터
      const chunkFileNames = new Set(
        chunk.files.map((f) => f.path || f.name)
      );
      const chunkRuleMatches = allRuleMatches.filter((m) => {
        const loc = m.location ?? "";
        return [...chunkFileNames].some((name) => loc.includes(name));
      });

      try {
        const llmRes = await this.llmClient.analyze({
          module: "static_analysis",
          sourceCode: chunk.sourceCode,
          ruleResults: chunkRuleMatches.map((m) => ({
            ruleId: m.ruleId,
            title: m.title,
            severity: m.severity,
            location: m.location,
          })),
        }, llmUrl, requestId);

        if (llmRes.success) {
          const chunkVulns = llmRes.vulnerabilities.map((v, vi) => ({
            id: `VULN-LLM-${Date.now()}-${i}-${vi}`,
            severity: validateLlmSeverity(v.severity) as Severity,
            title: v.title,
            description: v.description,
            location: v.location ?? undefined,
            source: "llm" as const,
            suggestion: v.suggestion ?? undefined,
            fixCode: v.fixCode ?? undefined,
          }));
          allLlmVulns.push(...chunkVulns);

          if (llmRes.note) {
            warnings.push({
              code: "LLM_NOTE",
              message: llmRes.note,
              details: chunk.files.map((f) => f.path || f.name).join(", "),
            });
          }
        } else {
          warnings.push({
            code: "LLM_CHUNK_FAILED",
            message: `LLM analysis failed for chunk ${i + 1}/${totalChunks}: ${llmRes.error ?? "unknown error"}`,
            details: chunk.files.map((f) => f.path || f.name).join(", "),
          });
          this.sendWarning(id, "LLM_CHUNK_FAILED", `Chunk ${i + 1} failed`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        logger.warn({ err, analysisId: id, chunk: i + 1 }, "LLM chunk analysis failed");
        warnings.push({
          code: "LLM_CHUNK_FAILED",
          message: `LLM request error for chunk ${i + 1}/${totalChunks}: ${errMsg}`,
          details: chunk.files.map((f) => f.path || f.name).join(", "),
        });
        this.sendWarning(id, "LLM_CHUNK_FAILED", `Chunk ${i + 1} error: ${errMsg}`);
      }
    }

    // 4. 병합 + 중복 제거 + 정렬
    this.sendProgress(id, "merging", 0, 1, "결과 병합 중...");
    const merged = this.mergeAndSort(ruleVulns, allLlmVulns);
    const summary = this.computeSummary(merged);
    this.sendProgress(id, "merging", 1, 1, "결과 병합 완료");

    // 5. 결과 생성 + 저장
    const result: AnalysisResult = {
      id,
      projectId,
      module: "static_analysis",
      status: "completed",
      vulnerabilities: merged,
      summary,
      ...(warnings.length > 0 ? { warnings } : {}),
      analyzedFileIds: fileIds,
      createdAt: new Date().toISOString(),
    };

    analysisResultDAO.save(result);

    // 6. 완료 이벤트
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
    this.wsManager?.broadcastStatic(analysisId, {
      type: "static-progress",
      payload: { analysisId, phase, current, total, message },
    });
  }

  private sendWarning(analysisId: string, code: string, message: string): void {
    this.wsManager?.broadcastStatic(analysisId, {
      type: "static-warning",
      payload: { analysisId, code, message },
    });
  }

  private sendComplete(analysisId: string): void {
    this.wsManager?.broadcastStatic(analysisId, {
      type: "static-complete",
      payload: { analysisId },
    });
  }

  // --- 기존 로직 ---

  private mergeAndSort(
    ruleVulns: Vulnerability[],
    llmVulns: Vulnerability[]
  ): Vulnerability[] {
    const ruleLocations = new Set(ruleVulns.map((v) => v.location));
    const uniqueLlm = llmVulns.filter((v) => !ruleLocations.has(v.location));
    const all = [...ruleVulns, ...uniqueLlm];
    all.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    return all;
  }

  private computeSummary(vulns: Vulnerability[]): AnalysisSummary {
    return {
      total: vulns.length,
      critical: vulns.filter((v) => v.severity === "critical").length,
      high: vulns.filter((v) => v.severity === "high").length,
      medium: vulns.filter((v) => v.severity === "medium").length,
      low: vulns.filter((v) => v.severity === "low").length,
      info: vulns.filter((v) => v.severity === "info").length,
    };
  }
}
