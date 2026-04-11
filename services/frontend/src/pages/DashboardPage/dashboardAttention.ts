import type { DashboardProject } from "./dashboardTypes";
import { totalFindings } from "./dashboardProjectSignals";

export type DashboardChipTone = "neutral" | "critical" | "high" | "medium" | "success" | "warning";

export interface DashboardChip {
  label: string;
  tone: DashboardChipTone;
}

export function gateTone(gateStatus?: string | null): "fail" | "warning" | null {
  if (gateStatus === "fail") return "fail";
  if (gateStatus === "warning") return "warning";
  return null;
}

export function gateLabel(gateStatus?: string | null): string | null {
  if (gateStatus === "fail") return "게이트 실패";
  if (gateStatus === "warning") return "게이트 경고";
  return null;
}

export function selectAttentionProjects(projects: DashboardProject[], limit = 4): DashboardProject[] {
  return [...projects]
    .sort((a, b) => projectPriorityForAttention(b) - projectPriorityForAttention(a))
    .filter((project) => projectPriorityForAttention(project) > 0)
    .slice(0, limit);
}

export function selectNextMoveProject(
  attentionProjects: DashboardProject[],
  filteredProjects: DashboardProject[],
  allProjects: DashboardProject[],
): DashboardProject | null {
  return attentionProjects[0] ?? filteredProjects[0] ?? allProjects[0] ?? null;
}

export function attentionDescription(project: DashboardProject): string {
  const total = totalFindings(project);
  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  const medium = project.severitySummary?.medium ?? 0;
  const unresolved = project.unresolvedDelta ?? 0;

  if (critical > 0) {
    return `치명적 ${critical}건을 포함해 탐지 항목 ${total}건이 확인되었습니다.`;
  }

  if (high > 0) {
    return `높음 ${high}건을 포함해 탐지 항목 ${total}건이 확인되었습니다.`;
  }

  if (medium > 0) {
    return `보통 ${medium}건을 포함해 탐지 항목 ${total}건이 확인되었습니다.`;
  }

  if (project.gateStatus === "fail") {
    return "품질 게이트 실패로 추가 확인이 필요합니다.";
  }

  if (project.gateStatus === "warning") {
    return "품질 게이트 경고 상태라 점검이 필요합니다.";
  }

  if (unresolved > 0) {
    return `미해결 항목이 ${unresolved}건 증가했습니다.`;
  }

  return "최근 변경 내용을 확인하세요.";
}

export function buildAttentionChips(project: DashboardProject) {
  return buildProjectChips(project).slice(0, 3);
}

function buildProjectChips(project: DashboardProject): DashboardChip[] {
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

function projectPriorityForAttention(project: DashboardProject): number {
  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  const medium = project.severitySummary?.medium ?? 0;
  const unresolved = project.unresolvedDelta ?? 0;
  const gatePenalty = project.gateStatus === "fail" ? 40 : project.gateStatus === "warning" ? 18 : 0;
  return critical * 100 + high * 20 + medium * 5 + unresolved + gatePenalty;
}
