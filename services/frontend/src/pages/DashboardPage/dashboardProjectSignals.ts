import { formatRelativeTime } from "../../utils/format";
import type { DashboardProject } from "./dashboardTypes";

export interface ProjectOwnerDisplay {
  avatar: string;
  name: string;
}

export function totalFindings(project: DashboardProject): number {
  return (project.severitySummary?.critical ?? 0)
    + (project.severitySummary?.high ?? 0)
    + (project.severitySummary?.medium ?? 0)
    + (project.severitySummary?.low ?? 0);
}

export function unresolvedFindings(project: DashboardProject): number {
  return Math.max(0, project.unresolvedDelta ?? 0);
}

export function projectIsRunning(project: DashboardProject): boolean {
  return (project as { gateStatus?: string | null }).gateStatus === "running";
}

export function recentProjectUpdate(project: DashboardProject): string {
  if (projectIsRunning(project)) {
    return "진행 중";
  }

  const timestamp = latestProjectTimestamp(project);
  if (!timestamp) {
    return "최근 업데이트 · —";
  }

  return `최근 업데이트 · ${formatRelativeTime(timestamp)}`;
}

export function latestProjectTimestamp(project: DashboardProject): string | null {
  return project.lastAnalysisAt || project.updatedAt || null;
}

export function projectDisplayWhen(project: DashboardProject): string {
  const timestamp = latestProjectTimestamp(project);
  return timestamp ? formatRelativeTime(timestamp) : "—";
}

export function projectPendingApprovals(project: DashboardProject): number {
  const explicit = (project as { pendingApprovals?: number }).pendingApprovals;
  if (typeof explicit === "number") {
    return Math.max(0, explicit);
  }

  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  if (projectIsRunning(project)) {
    return Math.max(1, Math.ceil((critical + high + 1) / 2));
  }
  if (project.gateStatus === "fail") {
    return Math.max(1, critical + Math.ceil(high / 2));
  }
  if (project.gateStatus === "warning") {
    return Math.max(1, Math.ceil(high / 2));
  }
  return 0;
}

/**
 * Return owner display block from S2 contract (`ProjectListItem.owner`).
 * Returns null when S2 omits owner (migrated/legacy rows or unauthenticated
 * dev creations) — caller renders dim placeholder.
 *
 * Avatar fallback rule (per s2→s1 reply WR 2026-04-27): when owner.avatar is
 * absent or null, S1 derives from the first 1-2 chars of name.
 */
export function projectOwner(project: DashboardProject): ProjectOwnerDisplay | null {
  const owner = project.owner;
  if (!owner) return null;
  const avatar = owner.avatar ?? Array.from(owner.name).slice(0, 2).join("");
  return { avatar: avatar || owner.name.charAt(0), name: owner.name };
}

export function projectLanguage(project: DashboardProject): "c" | "cpp" | "rust" | "ts" | "py" {
  const explicit = (project as { lang?: "c" | "cpp" | "rust" | "ts" | "py" }).lang;
  if (explicit) {
    return explicit;
  }

  const haystack = `${project.name} ${project.description}`.toLowerCase();
  if (haystack.includes("rust") || haystack.includes("adas")) return "rust";
  if (haystack.includes("python") || haystack.includes("harness")) return "py";
  if (haystack.includes("service") || haystack.includes("ota") || haystack.includes("telematics")) return "ts";
  if (haystack.includes("cpp") || haystack.includes("c++") || haystack.includes("hypervisor") || haystack.includes("bms") || haystack.includes("ivi")) return "cpp";
  return "c";
}

export function projectMetaLabel(project: DashboardProject): string {
  const explicit = (project as { metaLabel?: string }).metaLabel;
  if (explicit) {
    return explicit;
  }

  const lang = projectLanguage(project);
  if (lang === "rust") return "ADAS · ISO 26262 ASIL-D";
  if (lang === "cpp") return "BMS · CAN-FD";
  if (lang === "ts") return "OTA · Cloud Edge";
  if (lang === "py") return "Tooling · Evaluation";
  return "ECU · AUTOSAR Classic";
}

export function latestSyncLabel(projects: DashboardProject[]): string {
  const latest = [...projects]
    .map(latestProjectTimestamp)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];

  if (!latest) {
    return "—";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(latest));
}

export function criticalOpenTotal(projects: DashboardProject[]): number {
  return projects.reduce((sum, project) => sum + (project.severitySummary?.critical ?? 0), 0);
}

export function pendingApprovalsTotal(projects: DashboardProject[]): number {
  return projects.reduce((sum, project) => sum + projectPendingApprovals(project), 0);
}
