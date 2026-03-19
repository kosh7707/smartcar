import React from "react";
import type { FindingStatus } from "@aegis/shared";
import { FINDING_STATUS_LABELS, FINDING_STATUS_ORDER } from "../../constants/finding";

interface Props {
  byStatus: Record<string, number>;
}

const STATUS_CSS_KEY: Record<string, string> = {
  open: "open",
  needs_review: "needs-review",
  accepted_risk: "accepted-risk",
  false_positive: "false-positive",
  fixed: "fixed",
  needs_revalidation: "needs-revalidation",
  sandbox: "sandbox",
};

export const FindingSummary: React.FC<Props> = ({ byStatus }) => {
  const entries = FINDING_STATUS_ORDER
    .filter((s) => (byStatus[s] ?? 0) > 0)
    .map((s) => ({ status: s, count: byStatus[s], cssKey: STATUS_CSS_KEY[s] ?? s }));

  const total = entries.reduce((sum, e) => sum + e.count, 0);
  if (total === 0) return null;

  return (
    <div className="status-bar-container">
      <div className="status-bar">
        {entries.map((e) => (
          <div
            key={e.status}
            className="status-bar__segment"
            style={{
              width: `${(e.count / total) * 100}%`,
              background: `var(--status-${e.cssKey})`,
            }}
          />
        ))}
      </div>
      <div className="status-bar__legend">
        {entries.map((e) => (
          <div key={e.status} className="status-bar__legend-item">
            <span
              className="status-bar__dot"
              style={{ background: `var(--status-${e.cssKey})` }}
            />
            <span className="status-bar__legend-label">
              {FINDING_STATUS_LABELS[e.status]}
            </span>
            <span className="status-bar__legend-value">{e.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
