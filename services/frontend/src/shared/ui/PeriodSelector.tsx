import React from "react";
import { Button } from "@/components/ui/button";

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
  <div className="period-selector">
    {OPTIONS.map((opt) => (
      <Button
        key={opt.value}
        type="button"
        variant={value === opt.value ? "default" : "ghost"}
        size="sm"
        className={value === opt.value ? "period-selector__button is-active" : "period-selector__button"}
        onClick={() => onChange(opt.value)}
      >
        {opt.label}
      </Button>
    ))}
  </div>
);
