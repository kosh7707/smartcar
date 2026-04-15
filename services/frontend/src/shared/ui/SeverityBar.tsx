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
  critical: "var(--aegis-severity-critical)",
  high: "var(--aegis-severity-high)",
  medium: "var(--aegis-severity-medium)",
  low: "var(--aegis-severity-low)",
  info: "var(--aegis-severity-info)",
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
    <div className="mb-5" title={compactTooltip}>
      {/* Bar */}
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {segments.map((s) => (
          <div
            key={s.key}
            className="min-w-0 transition-[width] duration-500 ease-out"
            style={{ width: `${(s.value / total) * 100}%`, background: SEVERITY_COLORS[s.key] }}
          />
        ))}
      </div>
      {/* Legend (hidden in compact mode) */}
      {!compact && (
        <div className="mt-3 flex flex-wrap gap-5">
          {segments.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLORS[s.key] }} />
              <span className="text-sm text-muted-foreground">{LABELS[s.key]}</span>
              <span className="text-sm font-semibold text-foreground">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
