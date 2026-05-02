import React from "react";
import type { GateResult } from "@aegis/shared";
import { formatDateTime } from "@/common/utils/format";

interface Props {
  gate: GateResult;
  compact?: boolean;
}

const STATUS_CONFIG = {
  pass: {
    label: "통과",
    toneClass: "gate-result-tone gate-result-tone--pass",
    cardClass: "gate-result-card gate-result-card--pass",
  },
  fail: {
    label: "실패",
    toneClass: "gate-result-tone gate-result-tone--fail",
    cardClass: "gate-result-card gate-result-card--fail",
  },
  warning: {
    label: "경고",
    toneClass: "gate-result-tone gate-result-tone--warning",
    cardClass: "gate-result-card gate-result-card--warning",
  },
} as const;

export const GateResultCard: React.FC<Props> = ({ gate, compact }) => {
  const cfg = STATUS_CONFIG[gate.status];

  if (compact) {
    return <span className={cfg.toneClass}>{cfg.label}</span>;
  }

  return (
    <div className={`panel ${cfg.cardClass}`}>
      <div className="panel-body gate-result-card__body">
        <div className="gate-result-card__head">
          <span className="gate-result-card__title">Quality Gate: {cfg.label}</span>
          <span className="gate-result-card__time">{formatDateTime(gate.evaluatedAt)}</span>
        </div>
        <div className="gate-result-card__rules">
          {gate.rules.map((r) => {
            const tone =
              r.result === "passed"
                ? STATUS_CONFIG.pass.toneClass
                : r.result === "failed"
                  ? STATUS_CONFIG.fail.toneClass
                  : STATUS_CONFIG.warning.toneClass;
            return (
              <div key={r.ruleId} className="gate-result-card__rule">
                <span className={tone}>
                  {r.result === "passed" ? "PASS" : r.result === "failed" ? "FAIL" : "WARN"}
                </span>
                <span className="gate-result-card__message">{r.message}</span>
              </div>
            );
          })}
        </div>
        {gate.override ? (
          <div className="gate-result-card__override">
            Override by {gate.override.overriddenBy}: {gate.override.reason}
          </div>
        ) : null}
      </div>
    </div>
  );
};
