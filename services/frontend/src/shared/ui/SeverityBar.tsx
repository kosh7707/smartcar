import React from "react";
import "./SeverityBar.css";

interface Props {
  summary: { critical: number; high: number; medium: number; low: number; info?: number };
  compact?: boolean;
}

const LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const SeverityBar: React.FC<Props> = ({ summary, compact = false }) => {
  const total = summary.critical + summary.high + summary.medium + summary.low + (summary.info ?? 0);
  if (total === 0) return null;

  const segments = [
    { key: "critical", value: summary.critical },
    { key: "high", value: summary.high },
    { key: "medium", value: summary.medium },
    { key: "low", value: summary.low },
    { key: "info", value: summary.info ?? 0 },
  ].filter((s) => s.value > 0);

  const compactTooltip = compact
    ? segments.map((s) => `${LABELS[s.key][0]}:${s.value}`).join(" ")
    : undefined;

  return (
    <div className="severity-bar-container" title={compactTooltip}>
      {/* Bar */}
      <div className="severity-bar">
        {segments.map((s) => (
          <div
            key={s.key}
            className={`severity-bar__segment severity-bar__segment--${s.key}`}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      {/* Legend (hidden in compact mode) */}
      {!compact && (
        <div className="severity-bar__legend">
          {segments.map((s) => (
            <div key={s.key} className="severity-bar__legend-item">
              <span className={`severity-bar__dot severity-bar__dot--${s.key}`} />
              <span className="severity-bar__legend-label">{LABELS[s.key]}</span>
              <span className="severity-bar__legend-value">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
