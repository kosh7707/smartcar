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
    <Card className="gate-card quality-gate-card">
      <CardHeader className="quality-gate-card__header">
        <div className="quality-gate-card__header-row">
          <div className="quality-gate-card__header-copy">
            <Badge
              variant="outline"
              className={cn(config.badgeClassName)}
            >
              {config.label}
            </Badge>
            <CardTitle className="quality-gate-card__title">게이트 판정</CardTitle>
          </div>
          <p className="quality-gate-card__timestamp">
            {formatDateTime(gate.evaluatedAt)}
          </p>
        </div>
      </CardHeader>

      <CardContent className="quality-gate-card__body">
        <div className="quality-gate-card__rules">
          {[...gate.rules].sort(sortGateRules).map((rule, index) => (
            <React.Fragment key={rule.ruleId}>
              {index > 0 ? <Separator /> : null}
              <QualityGateRuleResultRow rule={rule} />
            </React.Fragment>
          ))}
        </div>

        {gate.override && (
          <div className="quality-gate-card__override">
            <span className="quality-gate-card__override-reason">오버라이드: {gate.override.reason}</span>
            <span className="quality-gate-card__override-actor">
              승인자 {gate.override.overriddenBy}
            </span>
          </div>
        )}

        {gate.status === "fail" && !gate.override && (
          <div className="quality-gate-card__actions">
            {isOverrideOpen ? (
              <div className="quality-gate-card__override-form">
                {failedCount > 0 && (
                  <div className="quality-gate-card__override-warning">
                    이 오버라이드로 {failedCount}건의 실패 규칙이 무시됩니다
                  </div>
                )}
                <div className="quality-gate-card__override-grid">
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
                    className="quality-gate-card__override-button"
                    onClick={onSubmitOverride}
                    disabled={overriding || overrideReason.trim().length < 10}
                  >
                    {overriding ? "처리 중..." : "오버라이드 확인"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="quality-gate-card__override-button"
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
