import React from "react";

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

const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--severity-critical)",
  high: "var(--severity-high)",
  medium: "var(--severity-medium)",
  low: "var(--severity-low)",
  info: "var(--severity-info)",
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
  ].filter((segment) => segment.value > 0);

  const compactTooltip = compact
    ? segments.map((segment) => `${LABELS[segment.key][0]}:${segment.value}`).join(" ")
    : undefined;

  return (
    <div className="severity-bar" title={compactTooltip}>
      <div className="severity-bar__track">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="severity-bar__segment"
            style={{ width: `${(segment.value / total) * 100}%`, background: SEVERITY_COLORS[segment.key] }}
          />
        ))}
      </div>
      {!compact ? (
        <div className="severity-bar__legend">
          {segments.map((segment) => (
            <div key={segment.key} className="severity-bar__legend-item">
              <span className="severity-bar__legend-dot" style={{ background: SEVERITY_COLORS[segment.key] }} />
              <span className="severity-bar__legend-label">{LABELS[segment.key]}</span>
              <span className="severity-bar__legend-value">{segment.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
