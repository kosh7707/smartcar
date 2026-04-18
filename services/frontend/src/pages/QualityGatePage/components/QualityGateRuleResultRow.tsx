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
        "space-y-2 rounded-xl border px-4 py-3",
        resultConfig.surfaceClassName,
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Badge
          variant="outline"
          className={cn(
            "min-h-7 min-w-16 justify-center rounded-full px-2.5 text-xs font-semibold",
            resultConfig.badgeClassName,
          )}
        >
          {resultConfig.label}
        </Badge>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">
              {ruleInfo?.label ?? rule.ruleId}
            </span>
            {rule.linkedFindingIds.length > 0 && (
              <Badge
                variant="outline"
                className="rounded-full px-2 text-[11px] text-muted-foreground"
              >
                탐지 항목 {rule.linkedFindingIds.length}건
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{rule.message}</p>
        </div>
      </div>

      {ruleInfo?.description && (
        <p className="text-xs leading-relaxed text-muted-foreground sm:pl-[4.75rem]">
          {ruleInfo.description}
        </p>
      )}
    </div>
  );
}
