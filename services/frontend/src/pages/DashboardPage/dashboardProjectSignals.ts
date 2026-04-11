import { formatRelativeTime } from "../../utils/format";
import type { DashboardProject } from "./dashboardTypes";

export function totalFindings(project: DashboardProject): number {
  return (project.severitySummary?.critical ?? 0)
    + (project.severitySummary?.high ?? 0)
    + (project.severitySummary?.medium ?? 0)
    + (project.severitySummary?.low ?? 0);
}

export function recentProjectUpdate(project: DashboardProject): string {
  const timestamp = project.lastAnalysisAt || project.updatedAt;
  return `최근 업데이트 · ${formatRelativeTime(timestamp)}`;
}
