import React from "react";
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
  const failedCount = gate.rules.filter((rule) => rule.result === "failed").length;

  return (
    <div className="gate-card card">
      <div className="gate-card__header">
        <div className={`gate-card__status ${config.className}`}>
          <span>{config.label}</span>
        </div>
        <span className="gate-card__time">
          {formatDateTime(gate.evaluatedAt)}
        </span>
      </div>

      <div className="gate-card__rules">
        {[...gate.rules].sort(sortGateRules).map((rule) => (
          <QualityGateRuleResultRow key={rule.ruleId} rule={rule} />
        ))}
      </div>

      {gate.override && (
        <div className="gate-card__override">
          <span>오버라이드: {gate.override.reason}</span>
          <span className="gate-card__override-by">승인자 {gate.override.overriddenBy}</span>
        </div>
      )}

      {gate.status === "fail" && !gate.override && (
        <div className="gate-card__actions">
          {isOverrideOpen ? (
            <div className="gate-override-form">
              {failedCount > 0 && (
                <div className="gate-override-form__warning">
                  이 오버라이드로 {failedCount}건의 실패 규칙이 무시됩니다
                </div>
              )}
              <div className="gate-override-form__controls">
                <input
                  type="text"
                  className="input input-sm"
                  placeholder="오버라이드 사유를 입력하세요 (최소 10자)"
                  value={overrideReason}
                  onChange={(event) => onSetOverrideReason(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && overrideReason.trim().length >= 10 && onSubmitOverride()}
                />
                <button
                  className="btn btn-sm gate-override-form__confirm"
                  onClick={onSubmitOverride}
                  disabled={overriding || overrideReason.trim().length < 10}
                >
                  {overriding ? "처리 중..." : "오버라이드 확인"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={onCancelOverride}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => onSetOverrideTarget(gate.id)}>
              오버라이드
            </button>
          )}
        </div>
      )}
    </div>
  );
}
