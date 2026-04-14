import React from "react";
import type { GateResult } from "../../../api/gate";
import { formatDateTime } from "../../../utils/format";

export function QualityGateStatusBanner({ gate }: { gate: GateResult }) {
  const verdict = gate.status === "pass" ? "PASS" : gate.status === "fail" ? "FAIL" : "WARN";
  const tone = gate.status === "pass" ? "pass" : gate.status === "fail" ? "fail" : "warning";

  return (
    <div className={`gate-status-banner gate-status-banner--${tone}`}>
      <div className="gate-status-banner__left">
        <div className="gate-status-banner__verdict">{verdict}</div>
        <div className="gate-status-banner__subtitle">Quality Gate</div>
        <div className="gate-status-banner__time">
          Last evaluated: {formatDateTime(gate.evaluatedAt)}
        </div>
      </div>
    </div>
  );
}
