import crypto from "crypto";
import type {
  GateResult,
  GateRuleResult,
  GateRuleId,
  GateStatus,
  Finding,
  EvidenceRef,
} from "@smartcar/shared";
import { findingDAO } from "../dao/finding.dao";
import { evidenceRefDAO } from "../dao/evidence-ref.dao";
import { gateResultDAO } from "../dao/gate-result.dao";
import { runDAO } from "../dao/run.dao";
import { createLogger } from "../lib/logger";
import { NotFoundError } from "../lib/errors";

const logger = createLogger("quality-gate");

/** sandbox/false_positive/accepted_risk 상태의 finding은 severity 규칙에서 제외 */
const EXCLUDED_STATUSES = new Set(["sandbox", "false_positive", "accepted_risk"]);

const HIGH_THRESHOLD = 5;

export class QualityGateService {
  /**
   * Run 완료 후 자동 평가.
   * 이미 평가된 Run이면 기존 결과를 반환한다 (멱등).
   */
  evaluateRun(runId: string): GateResult {
    const existing = gateResultDAO.findByRunId(runId);
    if (existing) {
      logger.debug({ runId, gateId: existing.id }, "Gate already evaluated — returning existing");
      return existing;
    }

    const run = runDAO.findById(runId);
    if (!run) throw new NotFoundError(`Run not found: ${runId}`);

    const findings = findingDAO.findByRunId(runId);
    const rules = this.evaluateRules(findings);
    const status = this.deriveStatus(rules);
    const now = new Date().toISOString();

    const result: GateResult = {
      id: `gate-${crypto.randomUUID()}`,
      runId,
      projectId: run.projectId,
      status,
      rules,
      evaluatedAt: now,
      createdAt: now,
    };

    gateResultDAO.save(result);
    logger.info({ gateId: result.id, runId, status, ruleCount: rules.length }, "Gate evaluated");
    return result;
  }

  /** Gate override 적용 (승인 완료 후 호출) */
  applyOverride(gateId: string, actor: string, reason: string, approvalId: string): GateResult {
    const gate = gateResultDAO.findById(gateId);
    if (!gate) throw new NotFoundError(`Gate result not found: ${gateId}`);

    const override: GateResult["override"] = {
      overriddenBy: actor,
      reason,
      approvalId,
      overriddenAt: new Date().toISOString(),
    };

    gateResultDAO.updateOverride(gateId, override);
    logger.info({ gateId, actor, approvalId }, "Gate overridden");

    return { ...gate, status: "pass", override };
  }

  getById(id: string): GateResult | undefined {
    return gateResultDAO.findById(id);
  }

  getByRunId(runId: string): GateResult | undefined {
    return gateResultDAO.findByRunId(runId);
  }

  getByProjectId(projectId: string): GateResult[] {
    return gateResultDAO.findByProjectId(projectId);
  }

  // ── 내부 규칙 평가 ──

  private evaluateRules(findings: Finding[]): GateRuleResult[] {
    return [
      this.noCritical(findings),
      this.highThreshold(findings),
      this.evidenceCoverage(findings),
      this.sandboxUnreviewed(findings),
    ];
  }

  private deriveStatus(rules: GateRuleResult[]): GateStatus {
    if (rules.some((r) => r.result === "failed")) return "fail";
    if (rules.some((r) => r.result === "warning")) return "warning";
    return "pass";
  }

  /** severity=critical AND 활성 상태 finding → fail */
  private noCritical(findings: Finding[]): GateRuleResult {
    const matched = findings.filter(
      (f) => f.severity === "critical" && !EXCLUDED_STATUSES.has(f.status)
    );
    return {
      ruleId: "no-critical" as GateRuleId,
      result: matched.length > 0 ? "failed" : "passed",
      message:
        matched.length > 0
          ? `${matched.length}건의 활성 critical finding 존재`
          : "활성 critical finding 없음",
      linkedFindingIds: matched.map((f) => f.id),
    };
  }

  /** severity=high AND 활성 상태 finding ≥ HIGH_THRESHOLD → warning */
  private highThreshold(findings: Finding[]): GateRuleResult {
    const matched = findings.filter(
      (f) => f.severity === "high" && !EXCLUDED_STATUSES.has(f.status)
    );
    return {
      ruleId: "high-threshold" as GateRuleId,
      result: matched.length >= HIGH_THRESHOLD ? "warning" : "passed",
      message:
        matched.length >= HIGH_THRESHOLD
          ? `활성 high finding ${matched.length}건 (임계치: ${HIGH_THRESHOLD})`
          : `활성 high finding ${matched.length}건 — 임계치 이내`,
      linkedFindingIds: matched.length >= HIGH_THRESHOLD ? matched.map((f) => f.id) : [],
    };
  }

  /** Evidence가 없는 finding → warning */
  private evidenceCoverage(findings: Finding[]): GateRuleResult {
    const noEvidence: string[] = [];
    for (const f of findings) {
      if (EXCLUDED_STATUSES.has(f.status)) continue;
      const refs = evidenceRefDAO.findByFindingId(f.id);
      if (refs.length === 0) noEvidence.push(f.id);
    }
    return {
      ruleId: "evidence-coverage" as GateRuleId,
      result: noEvidence.length > 0 ? "warning" : "passed",
      message:
        noEvidence.length > 0
          ? `${noEvidence.length}건의 finding에 증적(evidence) 없음`
          : "모든 활성 finding에 증적 존재",
      linkedFindingIds: noEvidence,
    };
  }

  /** sandbox 상태(LLM-only 미검증) finding → warning */
  private sandboxUnreviewed(findings: Finding[]): GateRuleResult {
    const matched = findings.filter((f) => f.status === "sandbox");
    return {
      ruleId: "sandbox-unreviewed" as GateRuleId,
      result: matched.length > 0 ? "warning" : "passed",
      message:
        matched.length > 0
          ? `${matched.length}건의 LLM-only finding 미검증 (sandbox)`
          : "미검증 sandbox finding 없음",
      linkedFindingIds: matched.map((f) => f.id),
    };
  }
}
