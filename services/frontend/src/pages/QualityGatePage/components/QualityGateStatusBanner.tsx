import React from "react";
import type { GateResult } from "../../../api/gate";
import { formatDateTime } from "../../../utils/format";

export function QualityGateStatusBanner({ gate }: { gate: GateResult }) {
  const verdict = gate.status === "pass" ? "통과" : gate.status === "fail" ? "차단" : "경고";
  const tone = gate.status === "pass" ? "pass" : gate.status === "fail" ? "fail" : "warning";

  return (
    <div className={`gate-status-banner gate-status-banner--${tone}`}>
      <div className="gate-status-banner__left">
        <div className="gate-status-banner__verdict">{verdict}</div>
        <div className="gate-status-banner__subtitle">품질 게이트</div>
        <div className="gate-status-banner__time">
          최근 평가: {formatDateTime(gate.evaluatedAt)}
        </div>
      </div>
    </div>
  );
}
