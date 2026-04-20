import React from "react";
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
    .filter((status) => (byStatus[status] ?? 0) > 0)
    .map((status) => ({ status, count: byStatus[status], cssKey: STATUS_CSS_KEY[status] ?? status }));

  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) return null;

  return (
    <div className="finding-summary">
      <div className="finding-summary__bar">
        {entries.map((entry) => (
          <div
            key={entry.status}
            className="finding-summary__segment"
            style={{
              width: `${(entry.count / total) * 100}%`,
              background: `var(--status-${entry.cssKey})`,
            }}
          />
        ))}
      </div>
      <div className="finding-summary__legend">
        {entries.map((entry) => (
          <div key={entry.status} className="finding-summary__legend-item">
            <span
              className="finding-summary__legend-dot"
              style={{ background: `var(--status-${entry.cssKey})` }}
            />
            <span className="finding-summary__legend-label">
              {FINDING_STATUS_LABELS[entry.status]}
            </span>
            <span className="finding-summary__legend-value">{entry.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
