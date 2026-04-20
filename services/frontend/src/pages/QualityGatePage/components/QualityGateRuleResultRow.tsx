import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GateRuleResult } from "../../../api/gate";
import { RULE_INFO, RULE_RESULT_CONFIG } from "../qualityGatePresentation";

export function QualityGateRuleResultRow({ rule }: { rule: GateRuleResult }) {
  const ruleInfo = RULE_INFO[rule.ruleId];
  const resultConfig = RULE_RESULT_CONFIG[rule.result];

  return (
    <div
      className={cn(
        "quality-gate-rule",
        resultConfig.surfaceClassName,
      )}
    >
      <div className="quality-gate-rule__row">
        <Badge
          variant="outline"
          className={cn(resultConfig.badgeClassName, "quality-gate-rule__badge")}
        >
          {resultConfig.label}
        </Badge>

        <div className="quality-gate-rule__copy">
          <div className="quality-gate-rule__head">
            <span className="quality-gate-rule__title">
              {ruleInfo?.label ?? rule.ruleId}
            </span>
            {rule.linkedFindingIds.length > 0 && (
              <Badge
                variant="outline"
                className="quality-gate-rule__finding-count"
              >
                탐지 항목 {rule.linkedFindingIds.length}건
              </Badge>
            )}
          </div>
          <p className="quality-gate-rule__message">{rule.message}</p>
        </div>
      </div>

      {ruleInfo?.description && (
        <p className="quality-gate-rule__description">
          {ruleInfo.description}
        </p>
      )}
    </div>
  );
}
