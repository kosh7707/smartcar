import React from "react";
import type { GateResult } from "@aegis/shared";
import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { formatDateTime } from "../../utils/format";

interface Props {
  gate: GateResult;
  compact?: boolean;
}

const STATUS_CONFIG = {
  pass: { icon: ShieldCheck, color: "var(--cds-support-success)", label: "통과", cls: "gate-badge--pass" },
  fail: { icon: ShieldAlert, color: "var(--aegis-severity-critical)", label: "실패", cls: "gate-badge--fail" },
  warning: { icon: AlertTriangle, color: "var(--aegis-severity-medium)", label: "경고", cls: "gate-badge--cds-support-warning" },
} as const;

export const GateResultCard: React.FC<Props> = ({ gate, compact }) => {
  const cfg = STATUS_CONFIG[gate.status];
  const Icon = cfg.icon;

  if (compact) {
    return (
      <span className={`badge ${cfg.cls}`}>
        <Icon size={11} />
        {cfg.label}
      </span>
    );
  }

  return (
    <div className={`card gate-card--${gate.status}`}>
      <div className="gate-card__header">
        <Icon size={18} className={`gate-card__header-icon--${gate.status}`} />
        <span className="gate-card__title">Quality Gate: {cfg.label}</span>
        <span className="text-xs text-tertiary gate-card__time">
          {formatDateTime(gate.evaluatedAt)}
        </span>
      </div>
      <div className="gate-card__rules">
        {gate.rules.map((r) => (
          <div key={r.ruleId} className="gate-card__rule-row">
            <span className={`badge badge-xs ${r.result === "passed" ? "gate-badge--pass" : r.result === "failed" ? "gate-badge--fail" : "gate-badge--cds-support-warning"}`}>
              {r.result === "passed" ? "PASS" : r.result === "failed" ? "FAIL" : "WARN"}
            </span>
            <span>{r.message}</span>
          </div>
        ))}
      </div>
      {gate.override && (
        <div className="text-xs text-tertiary gate-card__override">
          Override by {gate.override.overriddenBy}: {gate.override.reason}
        </div>
      )}
    </div>
  );
};
