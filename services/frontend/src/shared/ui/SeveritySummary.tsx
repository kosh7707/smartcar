import React from "react";

interface Props {
  summary: { critical: number; high: number; medium: number; low: number; info?: number };
  compact?: boolean;
}

const items = [
  { key: "C", field: "critical" as const, cls: "bg-[var(--aegis-severity-critical)]" },
  { key: "H", field: "high" as const, cls: "bg-[var(--aegis-severity-high)]" },
  { key: "M", field: "medium" as const, cls: "bg-[var(--aegis-severity-medium)] text-black" },
  { key: "L", field: "low" as const, cls: "bg-[var(--aegis-severity-low)]" },
];

export const SeveritySummary: React.FC<Props> = ({ summary, compact = true }) => {
  const visible = compact ? items.filter((i) => summary[i.field] > 0) : items;
  if (visible.length === 0) return null;
  return (
    <div className="flex gap-2">
      {visible.map((i) => (
        <span key={i.key} className={`inline-flex min-h-6 items-center rounded-full px-2 text-sm font-medium text-white ${i.cls}`}>
          {i.key}:{summary[i.field]}
        </span>
      ))}
    </div>
  );
};
