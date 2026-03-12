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
} from "@smartcar/shared";
import db from "../db";
import { runDAO } from "../dao/run.dao";
import { findingDAO } from "../dao/finding.dao";
import { evidenceRefDAO } from "../dao/evidence-ref.dao";
import { createLogger } from "../lib/logger";

const logger = createLogger("result-normalizer");

export interface NormalizerContext {
  analyzedFileIds?: string[];
  sessionId?: string;
  testResultId?: string;
}

export class ResultNormalizer {
  normalizeAnalysisResult(result: AnalysisResult, context?: NormalizerContext): Run | undefined {
    // 멱등성: 이미 정규화된 결과면 skip
    const existing = runDAO.findByAnalysisResultId(result.id);
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
        startedAt: result.createdAt,
        endedAt: now,
        createdAt: now,
      };

      // 원자적 저장: Run + Findings + EvidenceRefs
      const tx = db.transaction(() => {
        runDAO.save(run);
        if (findings.length > 0) findingDAO.saveMany(findings);
        if (evidenceRefs.length > 0) evidenceRefDAO.saveMany(evidenceRefs);
      });
      tx();

      logger.info({
        runId,
        analysisResultId: result.id,
        module: result.module,
        findingCount: findings.length,
        evidenceCount: evidenceRefs.length,
      }, "Analysis result normalized");

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
    if (result.module === "static_analysis" && context?.analyzedFileIds) {
      for (const fileId of context.analyzedFileIds) {
        refs.push({
          id: `evr-${crypto.randomUUID()}`,
          findingId,
          artifactId: fileId,
          artifactType: "uploaded-file",
          locatorType: "line-range",
          locator: this.parseLineRange(vuln.location),
          createdAt: now,
        });
      }
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
}
