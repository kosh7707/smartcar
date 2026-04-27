import React from "react";
import { ShieldX, AlertTriangle, ShieldCheck } from "lucide-react";
import type { GateRuleResult } from "../../../api/gate";
import {
  RULE_INFO,
  RULE_RESULT_CONFIG,
  formatThresholdCurrent,
  formatThresholdLimit,
} from "../qualityGatePresentation";

// Severity colors are gate-context P3 exception (handoff §2.2). No self-mapping (handoff §9).
function ruleIcon(mod: "blocked" | "warn" | "pass" | "running") {
  if (mod === "blocked") return <ShieldX aria-hidden="true" />;
  if (mod === "warn") return <AlertTriangle aria-hidden="true" />;
  return <ShieldCheck aria-hidden="true" />;
}

export function QualityGateRuleResultRow({ rule }: { rule: GateRuleResult }) {
  const ruleInfo = RULE_INFO[rule.ruleId];
  const resultConfig = RULE_RESULT_CONFIG[rule.result];
  const current = formatThresholdCurrent(rule);
  const limit = formatThresholdLimit(rule);
  const findings = rule.linkedFindingIds.length;
  const stateClass =
    resultConfig.gateMod === "blocked"
      ? "is-fail"
      : resultConfig.gateMod === "warn"
        ? "is-warn"
        : "is-pass";

  return (
    <div className={`gate-rule ${stateClass}`}>
      <div className="gate-rule__icon" aria-hidden="true">
        {ruleIcon(resultConfig.gateMod)}
      </div>

      <div className="gate-rule__copy">
        <div className="gate-rule__head">
          <span className="gate-rule__title">
            {ruleInfo?.label ?? rule.ruleId}
          </span>
          <span className="gate-rule__rule-id">{rule.ruleId}</span>
          {findings > 0 && (
            <span className="gate-rule__finding-count">탐지 항목 {findings}건</span>
          )}
          <span
            className={`cell-gate ${resultConfig.gateMod} gate-rule__pill`}
            aria-label={`규칙 결과 ${resultConfig.label}`}
          >
            {resultConfig.label}
          </span>
        </div>
        <p className="gate-rule__msg">{rule.message}</p>
        {ruleInfo?.description && (
          <p className="gate-rule__hint">{ruleInfo.description}</p>
        )}
      </div>

      <div className="gate-rule__threshold" aria-label="규칙 임계값">
        {current !== null ? (
          <span className="gate-rule__threshold-num">{current}</span>
        ) : (
          <span className="gate-rule__threshold-num is-placeholder" aria-label="임계값 미공급">
            —
          </span>
        )}
        {limit !== null ? (
          <span className="gate-rule__threshold-lim">{limit}</span>
        ) : (
          <span className="gate-rule__threshold-lim is-placeholder">/ —</span>
        )}
      </div>
    </div>
  );
}
