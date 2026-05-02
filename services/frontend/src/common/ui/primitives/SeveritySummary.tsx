import React from "react";
import { cn } from "@/common/utils/cn";

interface Props {
  summary: { critical: number; high: number; medium: number; low: number; info?: number };
  compact?: boolean;
}

const items = [
  { key: "C", field: "critical" as const, cls: "severity-summary-pill--critical" },
  { key: "H", field: "high" as const, cls: "severity-summary-pill--high" },
  { key: "M", field: "medium" as const, cls: "severity-summary-pill--medium" },
  { key: "L", field: "low" as const, cls: "severity-summary-pill--low" },
];

export const SeveritySummary: React.FC<Props> = ({ summary, compact = true }) => {
  const visible = compact ? items.filter((item) => summary[item.field] > 0) : items;
  if (visible.length === 0) return null;

  return (
    <div className="severity-summary">
      {visible.map((item) => (
        <span
          key={item.key}
          className={cn("severity-summary-pill", item.cls)}
        >
          {item.key}:{summary[item.field]}
        </span>
      ))}
    </div>
  );
};
