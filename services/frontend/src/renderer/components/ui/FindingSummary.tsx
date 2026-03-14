import React from "react";
import type { FindingStatus } from "@smartcar/shared";
import { FINDING_STATUS_LABELS, FINDING_STATUS_ORDER } from "../../constants/finding";

interface Props {
  byStatus: Record<string, number>;
}

export const FindingSummary: React.FC<Props> = ({ byStatus }) => {
  const entries = FINDING_STATUS_ORDER
    .filter((s) => (byStatus[s] ?? 0) > 0)
    .map((s) => ({ status: s, count: byStatus[s] }));

  if (entries.length === 0) return null;

  return (
    <span className="severity-summary">
      {entries.map(({ status, count }) => (
        <span key={status} className={`severity-chip badge-status--${status}`}>
          {FINDING_STATUS_LABELS[status].slice(0, 2)}:{count}
        </span>
      ))}
    </span>
  );
};
