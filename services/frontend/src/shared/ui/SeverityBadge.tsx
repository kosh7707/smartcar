import React from "react";
import type { Severity } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  severity: Severity | string;
  size?: "sm" | "md";
}

export const severityBadgeClass = (severity: Severity | string) => {
  switch (severity) {
    case "critical":
      return "border-[var(--aegis-severity-critical-border)] bg-[var(--aegis-severity-critical-bg)] text-[var(--aegis-severity-critical)]";
    case "high":
      return "border-[var(--aegis-severity-high-border)] bg-[var(--aegis-severity-high-bg)] text-[var(--aegis-severity-high)]";
    case "medium":
      return "border-[var(--aegis-severity-medium-border)] bg-[var(--aegis-severity-medium-bg)] text-[var(--aegis-severity-medium)]";
    case "low":
      return "border-[var(--aegis-severity-low-border)] bg-[var(--aegis-severity-low-bg)] text-[var(--aegis-severity-low)]";
    default:
      return "border-[var(--aegis-severity-info-border)] bg-[var(--aegis-severity-info-bg)] text-[var(--aegis-severity-info)]";
  }
};

export const SeverityBadge: React.FC<Props> = ({ severity, size = "md" }) => (
  <Badge variant="outline" className={cn(size === "sm" && "text-xs", `badge-severity--${severity}`, severityBadgeClass(severity))}>
    {severity.toUpperCase()}
  </Badge>
);
