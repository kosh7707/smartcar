import type { Severity } from "@aegis/shared";

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--aegis-severity-critical)",
  high: "var(--aegis-severity-high)",
  medium: "var(--aegis-severity-medium)",
  low: "var(--aegis-severity-low)",
  info: "var(--aegis-severity-info)",
};

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export function getSeverityColor(severity: string): string {
  return SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.info;
}
