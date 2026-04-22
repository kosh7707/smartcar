import React from "react";
import type { Severity } from "@aegis/shared";
import { cn } from "@/lib/utils";

interface Props {
  severity: Severity | string;
  size?: "sm" | "md";
}

export const severityBadgeClass = (severity: Severity | string) => {
  switch (severity) {
    case "critical":
      return "severity-badge severity-badge--critical";
    case "high":
      return "severity-badge severity-badge--high";
    case "medium":
      return "severity-badge severity-badge--medium";
    case "low":
      return "severity-badge severity-badge--low";
    default:
      return "severity-badge severity-badge--info";
  }
};

export const SeverityBadge: React.FC<Props> = ({ severity, size = "md" }) => (
  <span
    className={cn(
      severityBadgeClass(severity),
      `badge-severity--${severity}`,
      size === "sm" ? "severity-badge--sm text-xs" : "severity-badge--md",
    )}
  >
    {severity.toUpperCase()}
  </span>
);
