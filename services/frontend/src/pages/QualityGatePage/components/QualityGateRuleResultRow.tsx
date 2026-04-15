import React from "react";
import type { GateRuleResult } from "../../../api/gate";
import { RULE_INFO } from "../qualityGatePresentation";

export function QualityGateRuleResultRow({ rule }: { rule: GateRuleResult }) {
  const ruleInfo = RULE_INFO[rule.ruleId];

  return (
    <div className={`gate-rule gate-rule--${rule.result}`}>
      <div className="gate-rule__main">
        <span className={`gate-rule__result gate-rule__result--${rule.result}`}>
          {rule.result === "passed" ? "PASS" : rule.result === "failed" ? "FAIL" : "WARN"}
        </span>
        <span className="gate-rule__name">{ruleInfo?.label ?? rule.ruleId}</span>
        <span className="gate-rule__message">{rule.message}</span>
        {rule.linkedFindingIds.length > 0 && (
          <span className="gate-rule__findings">탐지 항목 {rule.linkedFindingIds.length}건</span>
        )}
      </div>
      {ruleInfo?.description && (
        <div className="gate-rule__description">
          {ruleInfo.description}
        </div>
      )}
    </div>
  );
}
