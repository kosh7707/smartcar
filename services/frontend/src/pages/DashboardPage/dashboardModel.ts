import type { ProjectListItem } from "@aegis/shared";
import { formatRelativeTime } from "../../utils/format";

export type EventType = "analysis" | "gate_pass" | "gate_fail" | "gate_warning" | "vulnerability" | "approval" | "upload";
export type ChipTone = "neutral" | "critical" | "high" | "medium" | "success" | "warning";

export type DashboardProject = ProjectListItem;

export interface DashboardChip {
  label: string;
  tone: ChipTone;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  projectName: string;
  type: EventType;
  description: string;
  chips?: DashboardChip[];
  timestamp: string;
}

export const EVENT_LABELS: Record<EventType, string> = {
  analysis: "분석 완료",
  gate_pass: "게이트 통과",
  gate_fail: "게이트 실패",
  gate_warning: "게이트 경고",
  vulnerability: "취약점",
  approval: "승인",
  upload: "업로드",
};

function buildPrimaryActivityEvent(project: DashboardProject): ActivityEvent | null {
  const timestamp = project.lastAnalysisAt || project.updatedAt;
  if (!timestamp) {
    return null;
  }

  const findingsTotal = totalFindings(project);

  if (project.gateStatus === "fail") {
    return {
      id: `${project.id}-gate-fail`,
      projectId: project.id,
      projectName: project.name,
      type: "gate_fail",
      description: "품질 게이트에 실패했습니다",
      chips: buildProjectChips(project).slice(0, 2),
      timestamp,
    };
  }

  if (project.gateStatus === "warning") {
    return {
      id: `${project.id}-gate-warning`,
      projectId: project.id,
      projectName: project.name,
      type: "gate_warning",
      description: "품질 게이트 경고 상태입니다",
      chips: buildProjectChips(project).slice(0, 2),
      timestamp,
    };
  }

  if (findingsTotal > 0) {
    return {
      id: `${project.id}-vulnerability`,
      projectId: project.id,
      projectName: project.name,
      type: "vulnerability",
      description: `취약점 ${findingsTotal}건이 발견되었습니다`,
      chips: buildProjectChips(project).slice(0, 2),
      timestamp,
    };
  }

  return {
    id: `${project.id}-analysis`,
    projectId: project.id,
    projectName: project.name,
    type: project.gateStatus === "pass" ? "gate_pass" : "analysis",
    description: project.gateStatus === "pass" ? "품질 게이트를 통과했습니다" : "정적 분석이 완료되었습니다",
    chips: [],
    timestamp,
  };
}

export function totalFindings(project: DashboardProject): number {
  return (project.severitySummary?.critical ?? 0)
    + (project.severitySummary?.high ?? 0)
    + (project.severitySummary?.medium ?? 0)
    + (project.severitySummary?.low ?? 0);
}

export function projectRowAccentClass(project: DashboardProject): string {
  const summary = project.severitySummary;
  if ((summary?.critical ?? 0) > 0) return "project-row--critical";
  if ((summary?.high ?? 0) > 0) return "project-row--high";
  if ((summary?.medium ?? 0) > 0) return "project-row--medium";
  if (project.gateStatus === "pass") return "project-row--pass";
  return "project-row--muted";
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

export function projectPriority(project: DashboardProject): number {
  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  const medium = project.severitySummary?.medium ?? 0;
  const unresolved = project.unresolvedDelta ?? 0;
  const gatePenalty = project.gateStatus === "fail" ? 40 : project.gateStatus === "warning" ? 18 : 0;
  return critical * 100 + high * 20 + medium * 5 + unresolved + gatePenalty;
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

export function buildActivity(projects: DashboardProject[]): ActivityEvent[] {
  return projects
    .map((project) => buildPrimaryActivityEvent(project))
    .filter((event): event is ActivityEvent => event !== null)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function recentProjectUpdate(project: DashboardProject): string {
  const timestamp = project.lastAnalysisAt || project.updatedAt;
  return `최근 업데이트 · ${formatRelativeTime(timestamp)}`;
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
