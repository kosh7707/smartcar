import crypto from "crypto";
import type {
  GateResult,
  GateRuleResult,
  GateRuleId,
  GateStatus,
  Finding,
  EvidenceRef,
} from "@aegis/shared";
import type { IFindingDAO, IEvidenceRefDAO, IGateResultDAO, IRunDAO } from "../dao/interfaces";
import type { ProjectSettingsService } from "./project-settings.service";
import { findGateProfile, DEFAULT_GATE_PROFILE_ID } from "./gate-profiles";
import type { GateProfile } from "@aegis/shared";
import { createLogger } from "../lib/logger";
import { NotFoundError } from "../lib/errors";
import { isVisibleAnalysisArtifact } from "../lib/analysis-visibility";

const logger = createLogger("quality-gate");

/** sandbox/false_positive/accepted_risk 상태의 finding은 severity 규칙에서 제외 */
const EXCLUDED_STATUSES = new Set(["sandbox", "false_positive", "accepted_risk"]);

const HIGH_THRESHOLD = 5;

export class QualityGateService {
  constructor(
    private findingDAO: IFindingDAO,
    private evidenceRefDAO: IEvidenceRefDAO,
    private gateResultDAO: IGateResultDAO,
    private runDAO: IRunDAO,
    private settingsService?: ProjectSettingsService,
    private notificationService?: import("./notification.service").NotificationService,
  ) {}

  /**
   * Run 완료 후 자동 평가.
   * 이미 평가된 Run이면 기존 결과를 반환한다 (멱등).
   */
  evaluateRun(runId: string): GateResult {
    const existing = this.gateResultDAO.findByRunId(runId);
    if (existing) {
      logger.debug({ runId, gateId: existing.id }, "Gate already evaluated — returning existing");
      return existing;
    }

    const run = this.runDAO.findById(runId);
    if (!run) throw new NotFoundError(`Run not found: ${runId}`);

    // Gate 프로필 해석
    let profile: GateProfile | undefined;
    if (this.settingsService) {
      const settings = this.settingsService.getAll(run.projectId);
      if (settings.gateProfileId) {
        profile = findGateProfile(settings.gateProfileId);
      }
    }
    if (!profile) profile = findGateProfile(DEFAULT_GATE_PROFILE_ID)!;

    const findings = this.findingDAO.findByRunId(runId);
    const rules = this.evaluateRules(findings, profile);
    const status = this.deriveStatus(rules);
    const now = new Date().toISOString();

    const result: GateResult = {
      id: `gate-${crypto.randomUUID()}`,
      runId,
      projectId: run.projectId,
      status,
      rules,
      profileId: profile.id,
      requestedBy: "system",
      evaluatedAt: now,
      createdAt: now,
    };

    this.gateResultDAO.save(result);
    logger.info({ gateId: result.id, runId, status, ruleCount: rules.length }, "Gate evaluated");

    if (this.notificationService && status === "fail") {
      try {
        const failedRules = rules.filter(r => r.result === "failed").map(r => r.ruleId).join(", ");
        this.notificationService.emit({
          projectId: run.projectId,
          type: "gate_failed",
          title: `Quality Gate 실패: ${failedRules}`,
          jobKind: "gate",
          resourceId: result.id,
        });
      } catch { /* 알림 실패는 Gate 결과에 영향 없음 */ }
    }

    return result;
  }

  /** Gate override 적용 (승인 완료 후 호출) */
  applyOverride(gateId: string, actor: string, reason: string, approvalId: string): GateResult {
    const gate = this.gateResultDAO.findById(gateId);
    if (!gate) throw new NotFoundError(`Gate result not found: ${gateId}`);

    const override: GateResult["override"] = {
      overriddenBy: actor,
      reason,
      approvalId,
      overriddenAt: new Date().toISOString(),
    };

    this.gateResultDAO.updateOverride(gateId, override);
    logger.info({ gateId, actor, approvalId }, "Gate overridden");

    return { ...gate, status: "pass", override };
  }

  getById(id: string): GateResult | undefined {
    const result = this.gateResultDAO.findById(id);
    return result && this.isAggregateVisibleGate(result) ? result : undefined;
  }

  getByRunId(runId: string): GateResult | undefined {
    const run = this.runDAO.findById(runId);
    if (!run || !isVisibleAnalysisArtifact(run)) return undefined;
    return this.gateResultDAO.findByRunId(runId);
  }

  getByProjectId(projectId: string): GateResult[] {
    return this.gateResultDAO.findByProjectId(projectId).filter((gate) => this.isAggregateVisibleGate(gate));
  }

  // ── 내부 규칙 평가 ──

  private evaluateRules(findings: Finding[], profile: GateProfile): GateRuleResult[] {
    const results: GateRuleResult[] = [];
    for (const pr of profile.rules) {
      if (!pr.enabled) continue;
      switch (pr.ruleId) {
        case "no-critical":
          results.push(this.noCritical(findings));
          break;
        case "high-threshold": {
          const threshold = (pr.params?.threshold as number) ?? HIGH_THRESHOLD;
          results.push(this.highThreshold(findings, threshold));
          break;
        }
        case "evidence-coverage":
          results.push(this.evidenceCoverage(findings));
          break;
        case "sandbox-unreviewed":
          results.push(this.sandboxUnreviewed(findings));
          break;
      }
    }
    return results;
  }

  private deriveStatus(rules: GateRuleResult[]): GateStatus {
    if (rules.some((r) => r.result === "failed")) return "fail";
    if (rules.some((r) => r.result === "warning")) return "warning";
    return "pass";
  }

  private isAggregateVisibleGate(result: GateResult): boolean {
    const run = this.runDAO.findById(result.runId);
    return !!run && isVisibleAnalysisArtifact(run);
  }

  private metric(current: number, threshold: number, unit: "count" | "percent" = "count") {
    return { current, threshold, unit, meta: { current, threshold, unit } };
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
      ...this.metric(matched.length, 0),
    };
  }

  /** severity=high AND 활성 상태 finding ≥ threshold → warning */
  private highThreshold(findings: Finding[], threshold = HIGH_THRESHOLD): GateRuleResult {
    const matched = findings.filter(
      (f) => f.severity === "high" && !EXCLUDED_STATUSES.has(f.status)
    );
    return {
      ruleId: "high-threshold" as GateRuleId,
      result: matched.length >= threshold ? "warning" : "passed",
      message:
        matched.length >= threshold
          ? `활성 high finding ${matched.length}건 (임계치: ${threshold})`
          : `활성 high finding ${matched.length}건 — 임계치 이내`,
      linkedFindingIds: matched.length >= threshold ? matched.map((f) => f.id) : [],
      ...this.metric(matched.length, threshold),
    };
  }

  /** Evidence가 없는 finding → warning */
  private evidenceCoverage(findings: Finding[]): GateRuleResult {
    const noEvidence: string[] = [];
    for (const f of findings) {
      if (EXCLUDED_STATUSES.has(f.status)) continue;
      const refs = this.evidenceRefDAO.findByFindingId(f.id);
      if (refs.length === 0) noEvidence.push(f.id);
    }
    const activeFindings = findings.filter((f) => !EXCLUDED_STATUSES.has(f.status));
    const coverage = activeFindings.length > 0
      ? Math.round(((activeFindings.length - noEvidence.length) / activeFindings.length) * 100)
      : 100;
    return {
      ruleId: "evidence-coverage" as GateRuleId,
      result: noEvidence.length > 0 ? "warning" : "passed",
      message:
        noEvidence.length > 0
          ? `${noEvidence.length}건의 finding에 증적(evidence) 없음`
          : "모든 활성 finding에 증적 존재",
      linkedFindingIds: noEvidence,
      ...this.metric(coverage, 100, "percent"),
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
      ...this.metric(matched.length, 0),
    };
  }
}
