import crypto from "crypto";
import type {
  AnalysisResult,
  Run,
  Finding,
  EvidenceRef,
  FindingStatus,
  FindingSourceType,
  Confidence,
  Vulnerability,
  Severity,
} from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IRunDAO, IFindingDAO, IEvidenceRefDAO } from "../dao/interfaces";
import { createLogger } from "../lib/logger";
import type { QualityGateService } from "./quality-gate.service";
import type { AgentResponseSuccess, AgentEvidenceRef } from "./agent-client";

const logger = createLogger("result-normalizer");

export interface NormalizerContext {
  analyzedFileIds?: string[];
  analyzedFiles?: Array<{ id: string; filePath: string }>;
  sessionId?: string;
  testResultId?: string;
  startedAt?: string;
  agentEvidenceRefs?: AgentEvidenceRef[];
}

export class ResultNormalizer {
  constructor(
    private db: DatabaseType,
    private runDAO: IRunDAO,
    private findingDAO: IFindingDAO,
    private evidenceRefDAO: IEvidenceRefDAO,
    private gateService?: QualityGateService,
  ) {}

  normalizeAnalysisResult(result: AnalysisResult, context?: NormalizerContext): Run | undefined {
    // 멱등성: 이미 정규화된 결과면 skip
    const existing = this.runDAO.findByAnalysisResultId(result.id);
    if (existing) {
      logger.debug({ analysisResultId: result.id, runId: existing.id }, "Already normalized — skipping");
      return existing;
    }

    try {
      const now = new Date().toISOString();
      const runId = `run-${crypto.randomUUID()}`;

      const findings: Finding[] = [];
      const evidenceRefs: EvidenceRef[] = [];

      for (const vuln of result.vulnerabilities) {
        const findingId = `finding-${crypto.randomUUID()}`;
        const { status, confidence, sourceType } = this.classifyVulnerability(vuln, result.module);

        findings.push({
          id: findingId,
          runId,
          projectId: result.projectId,
          module: result.module,
          status,
          severity: vuln.severity,
          confidence,
          sourceType,
          title: vuln.title,
          description: vuln.description,
          location: vuln.location,
          suggestion: vuln.suggestion,
          ruleId: vuln.ruleId,
          createdAt: now,
          updatedAt: now,
        });

        // EvidenceRef 생성
        const refs = this.buildEvidenceRefs(findingId, result, vuln, context, now);
        evidenceRefs.push(...refs);
      }

      const run: Run = {
        id: runId,
        projectId: result.projectId,
        module: result.module,
        status: result.status === "completed" ? "completed" : result.status === "failed" ? "failed" : "completed",
        analysisResultId: result.id,
        findingCount: findings.length,
        startedAt: context?.startedAt ?? result.createdAt,
        endedAt: now,
        createdAt: now,
      };

      // 원자적 저장: Run + Findings + EvidenceRefs
      // 주의: DAO.saveMany()는 내부에서 db.transaction()을 생성하므로
      // 중첩 트랜잭션을 피하기 위해 개별 save()를 직접 호출한다.
      const tx = this.db.transaction(() => {
        this.runDAO.save(run);
        for (const f of findings) this.findingDAO.save(f);
        for (const r of evidenceRefs) this.evidenceRefDAO.save(r);
      });
      tx();

      logger.info({
        runId,
        analysisResultId: result.id,
        module: result.module,
        findingCount: findings.length,
        evidenceCount: evidenceRefs.length,
      }, "Analysis result normalized");

      // Gate 평가 (실패해도 정규화 결과에 영향 없음)
      if (this.gateService) {
        try {
          const gate = this.gateService.evaluateRun(runId);
          logger.info({ runId, gateStatus: gate.status }, "Gate evaluated");
        } catch (err) {
          logger.warn({ err, runId }, "Gate evaluation failed — skipped");
        }
      }

      return run;
    } catch (err) {
      logger.error({ err, analysisResultId: result.id }, "Failed to normalize analysis result — pipeline unaffected");
      return undefined;
    }
  }

  private classifyVulnerability(
    vuln: Vulnerability,
    module: string
  ): { status: FindingStatus; confidence: Confidence; sourceType: FindingSourceType } {
    if (module === "dynamic_testing") {
      // 동적 테스트: llmAnalysis 필드 존재 시 both
      const hasLlm = vuln.description.includes("LLM 분석:");
      return {
        status: hasLlm ? "needs_review" : "open",
        confidence: vuln.severity === "critical" || vuln.severity === "high" ? "high" : "medium",
        sourceType: hasLlm ? "both" : "rule-engine",
      };
    }

    // 정적/동적 분석: source 필드로 판별
    if (vuln.source === "llm") {
      return { status: "sandbox", confidence: "medium", sourceType: "llm-assist" };
    }
    return { status: "open", confidence: "high", sourceType: "rule-engine" };
  }

  private buildEvidenceRefs(
    findingId: string,
    result: AnalysisResult,
    vuln: Vulnerability,
    context: NormalizerContext | undefined,
    now: string
  ): EvidenceRef[] {
    const refs: EvidenceRef[] = [];

    // 공통: AnalysisResult 자체를 증적으로 참조
    refs.push({
      id: `evr-${crypto.randomUUID()}`,
      findingId,
      artifactId: result.id,
      artifactType: "analysis-result",
      locatorType: this.getLocatorType(result.module),
      locator: this.buildLocator(vuln, result.module),
      createdAt: now,
    });

    // 모듈별 추가 증적
    if (result.module === "static_analysis" && context?.analyzedFiles) {
      // location에서 파일 경로를 추출하여 매칭되는 파일만 연결
      const matchedFile = this.findMatchingFile(vuln.location, context.analyzedFiles);
      if (matchedFile) {
        refs.push({
          id: `evr-${crypto.randomUUID()}`,
          findingId,
          artifactId: matchedFile.id,
          artifactType: "uploaded-file",
          locatorType: "line-range",
          locator: this.parseLineRange(vuln.location),
          createdAt: now,
        });
      }
    } else if (result.module === "static_analysis" && context?.analyzedFileIds) {
      // 레거시 fallback: analyzedFiles가 없으면 기존 방식 (단, location 매칭 시도)
      // 매칭 불가 시 증적 미생성 (과다 연결 방지)
    } else if (result.module === "dynamic_analysis" && context?.sessionId) {
      refs.push({
        id: `evr-${crypto.randomUUID()}`,
        findingId,
        artifactId: context.sessionId,
        artifactType: "dynamic-session",
        locatorType: "timestamp-window",
        locator: {},
        createdAt: now,
      });
    } else if (result.module === "dynamic_testing" && context?.testResultId) {
      refs.push({
        id: `evr-${crypto.randomUUID()}`,
        findingId,
        artifactId: context.testResultId,
        artifactType: "test-result",
        locatorType: "request-response-pair",
        locator: {},
        createdAt: now,
      });
    }

    return refs;
  }

  private getLocatorType(module: string): "line-range" | "packet-range" | "timestamp-window" | "request-response-pair" {
    switch (module) {
      case "static_analysis": return "line-range";
      case "dynamic_analysis": return "timestamp-window";
      case "dynamic_testing": return "request-response-pair";
      default: return "line-range";
    }
  }

  private buildLocator(vuln: Vulnerability, module: string): Record<string, unknown> {
    if (module === "static_analysis" && vuln.location) {
      return this.parseLineRange(vuln.location);
    }
    return {};
  }

  private findMatchingFile(
    location: string | undefined,
    files: Array<{ id: string; filePath: string }>
  ): { id: string; filePath: string } | undefined {
    if (!location || files.length === 0) return undefined;

    // location format: "filePath:lineNumber" or "filePath"
    const filePart = location.replace(/:(\d+)(?:-(\d+))?$/, "");
    if (!filePart) return undefined;

    // 정확 일치 우선, 없으면 경로 끝부분 일치
    return files.find((f) => f.filePath === filePart)
      ?? files.find((f) => filePart.endsWith(f.filePath) || f.filePath.endsWith(filePart));
  }

  private parseLineRange(location?: string): Record<string, unknown> {
    if (!location) return {};
    // location format: "filename:line" 또는 "filename:startLine-endLine"
    const lineMatch = location.match(/:(\d+)(?:-(\d+))?$/);
    if (lineMatch) {
      return {
        file: location.replace(/:(\d+)(?:-(\d+))?$/, ""),
        startLine: Number(lineMatch[1]),
        endLine: lineMatch[2] ? Number(lineMatch[2]) : Number(lineMatch[1]),
      };
    }
    return { file: location };
  }

  // ── Agent 결과 정규화 (claims → Finding) ──

  normalizeAgentResult(
    result: AnalysisResult,
    agentResponse: AgentResponseSuccess,
    context?: NormalizerContext,
  ): Run | undefined {
    const existing = this.runDAO.findByAnalysisResultId(result.id);
    if (existing) {
      logger.debug({ analysisResultId: result.id, runId: existing.id }, "Agent result already normalized — skipping");
      return existing;
    }

    try {
      const now = new Date().toISOString();
      const runId = `run-${crypto.randomUUID()}`;
      const assessment = agentResponse.result;

      const findings: Finding[] = [];
      const evidenceRefs: EvidenceRef[] = [];
      const severity = this.validateSeverity(assessment.suggestedSeverity);
      const confidence = this.mapAgentConfidence(assessment.confidence);

      for (const claim of assessment.claims) {
        const findingId = `finding-${crypto.randomUUID()}`;

        findings.push({
          id: findingId,
          runId,
          projectId: result.projectId,
          module: "deep_analysis",
          status: "needs_review" as FindingStatus,
          severity,
          confidence,
          sourceType: "agent" as FindingSourceType,
          title: this.extractTitle(claim.statement),
          description: claim.statement,
          location: claim.location ?? undefined,
          suggestion: assessment.recommendedNextSteps?.length ? assessment.recommendedNextSteps.join("\n") : undefined,
          detail: claim.detail ?? undefined,
          createdAt: now,
          updatedAt: now,
        });

        // Agent가 인용한 evidenceRef → EvidenceRef 매핑
        for (const refId of claim.supportingEvidenceRefs) {
          const agentRef = context?.agentEvidenceRefs?.find(r => r.refId === refId);
          if (agentRef) {
            const validArtifactTypes = new Set(["analysis-result", "uploaded-file", "dynamic-session", "test-result", "sast-finding", "agent-assessment"]);
            const artifactType = validArtifactTypes.has(agentRef.artifactType)
              ? (agentRef.artifactType as EvidenceRef["artifactType"])
              : "analysis-result";
            evidenceRefs.push({
              id: `evr-${crypto.randomUUID()}`,
              findingId,
              artifactId: agentRef.artifactId,
              artifactType,
              locatorType: "line-range",
              locator: agentRef.locator,
              createdAt: now,
            });
          }
        }

        // Agent assessment 자체를 증적으로 추가
        evidenceRefs.push({
          id: `evr-${crypto.randomUUID()}`,
          findingId,
          artifactId: result.id,
          artifactType: "agent-assessment",
          locatorType: "line-range",
          locator: claim.location ? this.parseLineRange(claim.location) : {},
          createdAt: now,
        });
      }

      const run: Run = {
        id: runId,
        projectId: result.projectId,
        module: "deep_analysis",
        status: "completed",
        analysisResultId: result.id,
        findingCount: findings.length,
        startedAt: context?.startedAt ?? result.createdAt,
        endedAt: now,
        createdAt: now,
      };

      const tx = this.db.transaction(() => {
        this.runDAO.save(run);
        for (const f of findings) this.findingDAO.save(f);
        for (const r of evidenceRefs) this.evidenceRefDAO.save(r);
      });
      tx();

      logger.info({
        runId,
        analysisResultId: result.id,
        claimCount: assessment.claims.length,
        findingCount: findings.length,
        evidenceCount: evidenceRefs.length,
        confidence: assessment.confidence,
      }, "Agent result normalized");

      if (this.gateService) {
        try {
          const gate = this.gateService.evaluateRun(runId);
          logger.info({ runId, gateStatus: gate.status }, "Gate evaluated");
        } catch (err) {
          logger.warn({ err, runId }, "Gate evaluation failed — skipped");
        }
      }

      return run;
    } catch (err) {
      logger.error({ err, analysisResultId: result.id }, "Failed to normalize agent result");
      return undefined;
    }
  }

  private mapAgentConfidence(confidence: number): Confidence {
    if (confidence >= 0.8) return "high";
    if (confidence >= 0.5) return "medium";
    return "low";
  }

  private validateSeverity(severity?: string | null): Severity {
    const valid = new Set(["critical", "high", "medium", "low", "info"]);
    if (severity && valid.has(severity)) return severity as Severity;
    return "medium";
  }

  private extractTitle(statement: string): string {
    // 첫 문장 추출 (마침표, 120자 제한)
    const firstSentence = statement.split(/[.。]/)[0] ?? statement;
    return firstSentence.length > 120
      ? firstSentence.slice(0, 117) + "..."
      : firstSentence;
  }
}
