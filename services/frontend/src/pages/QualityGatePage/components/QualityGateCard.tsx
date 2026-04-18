import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { GateResult } from "../../../api/gate";
import { formatDateTime } from "../../../utils/format";
import { STATUS_CONFIG, sortGateRules } from "../qualityGatePresentation";
import { QualityGateRuleResultRow } from "./QualityGateRuleResultRow";

type QualityGateCardProps = {
  gate: GateResult;
  overrideTarget: string | null;
  overrideReason: string;
  overriding: boolean;
  onSetOverrideTarget: (gateId: string | null) => void;
  onSetOverrideReason: (value: string) => void;
  onSubmitOverride: () => void;
  onCancelOverride: () => void;
};

export function QualityGateCard({
  gate,
  overrideTarget,
  overrideReason,
  overriding,
  onSetOverrideTarget,
  onSetOverrideReason,
  onSubmitOverride,
  onCancelOverride,
}: QualityGateCardProps) {
  const config = STATUS_CONFIG[gate.status] ?? STATUS_CONFIG.warning;
  const isOverrideOpen = overrideTarget === gate.id;
  const failedCount = gate.rules.filter(
    (rule) => rule.result === "failed",
  ).length;

  return (
    <Card className="gate-card overflow-hidden shadow-none">
      <CardHeader className="gap-3 border-b border-border bg-gradient-to-b from-muted/60 to-background/95 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge
              variant="outline"
              className={cn(
                "min-h-8 rounded-full px-3 text-sm font-semibold",
                config.badgeClassName,
              )}
            >
              {config.label}
            </Badge>
            <CardTitle className="text-base">게이트 판정</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(gate.evaluatedAt)}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="space-y-3">
          {[...gate.rules].sort(sortGateRules).map((rule, index) => (
            <React.Fragment key={rule.ruleId}>
              {index > 0 ? <Separator /> : null}
              <QualityGateRuleResultRow rule={rule} />
            </React.Fragment>
          ))}
        </div>

        {gate.override && (
          <div className="flex flex-wrap items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100">
            <span className="font-medium">오버라이드: {gate.override.reason}</span>
            <span className="text-xs text-amber-700/80 sm:ml-auto dark:text-amber-200/80">
              승인자 {gate.override.overriddenBy}
            </span>
          </div>
        )}

        {gate.status === "fail" && !gate.override && (
          <div className="space-y-3 border-t border-border pt-4">
            {isOverrideOpen ? (
              <div className="space-y-3">
                {failedCount > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100">
                    이 오버라이드로 {failedCount}건의 실패 규칙이 무시됩니다
                  </div>
                )}
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <Input
                    type="text"
                    placeholder="오버라이드 사유를 입력하세요 (최소 10자)"
                    value={overrideReason}
                    onChange={(event) =>
                      onSetOverrideReason(event.target.value)
                    }
                    onKeyDown={(event) =>
                      event.key === "Enter" &&
                      overrideReason.trim().length >= 10 &&
                      onSubmitOverride()
                    }
                  />
                  <Button
                    size="sm"
                    className="w-full lg:w-auto"
                    onClick={onSubmitOverride}
                    disabled={overriding || overrideReason.trim().length < 10}
                  >
                    {overriding ? "처리 중..." : "오버라이드 확인"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full lg:w-auto"
                    onClick={onCancelOverride}
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSetOverrideTarget(gate.id)}
              >
                오버라이드
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
