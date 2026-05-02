import React from "react";
import { cn } from "@/common/utils/cn";
import "./PeriodSelector.css";

export type DashboardPeriod = "7d" | "30d" | "90d" | "all";

interface Props {
  value: DashboardPeriod;
  onChange: (p: DashboardPeriod) => void;
}

const OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
  { value: "90d", label: "90일" },
  { value: "all", label: "전체" },
];

export const PeriodSelector: React.FC<Props> = ({ value, onChange }) => (
  <div className="period-selector" role="group" aria-label="기간 필터">
    {OPTIONS.map((opt) => (
      <button
        key={opt.value}
        type="button"
        className={cn(
          "period-selector__button",
          value === opt.value && "is-active",
        )}
        aria-pressed={value === opt.value}
        onClick={() => onChange(opt.value)}
      >
        {opt.label}
      </button>
    ))}
  </div>
);
