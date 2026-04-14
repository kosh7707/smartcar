import React from "react";
import type { GateResult } from "@aegis/shared";
import { formatDateTime } from "../../utils/format";

interface Props {
  gate: GateResult;
  compact?: boolean;
}

const STATUS_CONFIG = {
  pass: { label: "통과", cls: "gate-badge--pass" },
  fail: { label: "실패", cls: "gate-badge--fail" },
  warning: { label: "경고", cls: "gate-badge--cds-support-warning" },
} as const;

export const GateResultCard: React.FC<Props> = ({ gate, compact }) => {
  const cfg = STATUS_CONFIG[gate.status];

  if (compact) {
    return (
      <span className={`badge ${cfg.cls}`}>
        {cfg.label}
      </span>
    );
  }

  return (
    <div className={`card gate-card--${gate.status}`}>
      <div className="gate-card__header">
        <span className="gate-card__title">Quality Gate: {cfg.label}</span>
        <span className="gate-card__time">
          {formatDateTime(gate.evaluatedAt)}
        </span>
      </div>
      <div className="gate-card__rules">
        {gate.rules.map((r) => (
          <div key={r.ruleId} className="gate-card__rule-row">
            <span className={`badge badge-sm ${r.result === "passed" ? "gate-badge--pass" : r.result === "failed" ? "gate-badge--fail" : "gate-badge--cds-support-warning"}`}>
              {r.result === "passed" ? "PASS" : r.result === "failed" ? "FAIL" : "WARN"}
            </span>
            <span>{r.message}</span>
          </div>
        ))}
      </div>
      {gate.override && (
        <div className="gate-card__override">
          Override by {gate.override.overriddenBy}: {gate.override.reason}
        </div>
      )}
    </div>
  );
};
