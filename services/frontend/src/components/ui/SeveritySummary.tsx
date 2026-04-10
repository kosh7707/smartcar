import React from "react";

interface Props {
  summary: { critical: number; high: number; medium: number; low: number; info?: number };
  compact?: boolean;
}

const items = [
  { key: "C", field: "critical" as const, cls: "severity-chip--critical" },
  { key: "H", field: "high" as const, cls: "severity-chip--high" },
  { key: "M", field: "medium" as const, cls: "severity-chip--medium" },
  { key: "L", field: "low" as const, cls: "severity-chip--low" },
];

export const SeveritySummary: React.FC<Props> = ({ summary, compact = true }) => {
  const visible = compact
    ? items.filter((i) => summary[i.field] > 0)
    : items;

  if (visible.length === 0) return null;

  return (
    <div className="severity-summary">
      {visible.map((i) => (
        <span key={i.key} className={`severity-chip ${i.cls}`}>
          {i.key}:{summary[i.field]}
        </span>
      ))}
    </div>
  );
};
