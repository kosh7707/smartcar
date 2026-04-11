import { formatRelativeTime } from "../../utils/format";
import type { DashboardProject } from "./dashboardTypes";

export type ProjectExplorerRowTone = "critical" | "high" | "medium" | "pass" | "muted";
export type DashboardChipTone = "neutral" | "critical" | "high" | "medium" | "success" | "warning";

export interface DashboardChip {
  label: string;
  tone: DashboardChipTone;
}

export function totalFindings(project: DashboardProject): number {
  return (project.severitySummary?.critical ?? 0)
    + (project.severitySummary?.high ?? 0)
    + (project.severitySummary?.medium ?? 0)
    + (project.severitySummary?.low ?? 0);
}

export function projectRowTone(project: DashboardProject): ProjectExplorerRowTone {
  const summary = project.severitySummary;
  if ((summary?.critical ?? 0) > 0) return "critical";
  if ((summary?.high ?? 0) > 0) return "high";
  if ((summary?.medium ?? 0) > 0) return "medium";
  if (project.gateStatus === "pass") return "pass";
  return "muted";
}

export function buildProjectChips(project: DashboardProject): DashboardChip[] {
  const chips: DashboardChip[] = [];
  const total = totalFindings(project);
  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  const medium = project.severitySummary?.medium ?? 0;
  const low = project.severitySummary?.low ?? 0;

  chips.push({ label: `탐지 항목 ${total}건`, tone: total > 0 ? "neutral" : "success" });
  if (critical > 0) chips.push({ label: `치명적 ${critical}`, tone: "critical" });
  if (high > 0) chips.push({ label: `높음 ${high}`, tone: "high" });
  if (medium > 0) chips.push({ label: `보통 ${medium}`, tone: "medium" });
  if (low > 0) chips.push({ label: `낮음 ${low}`, tone: "neutral" });
  if ((project.unresolvedDelta ?? 0) > 0) chips.push({ label: `미해결 +${project.unresolvedDelta}`, tone: "warning" });

  return chips;
}

export function recentProjectUpdate(project: DashboardProject): string {
  const timestamp = project.lastAnalysisAt || project.updatedAt;
  return `최근 업데이트 · ${formatRelativeTime(timestamp)}`;
}
