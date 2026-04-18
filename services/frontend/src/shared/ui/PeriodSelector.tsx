import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
    {OPTIONS.map((opt) => (
      <Button
        key={opt.value}
        type="button"
        variant={value === opt.value ? "default" : "ghost"}
        size="sm"
        className={cn("h-7 px-2.5", value === opt.value && "bg-primary text-primary-foreground")}
        onClick={() => onChange(opt.value)}
      >
        {opt.label}
      </Button>
    ))}
  </div>
);
