import type { ProjectListItem } from "@aegis/shared";
import { formatRelativeTime } from "../../utils/format";

export type EventType = "analysis" | "gate_pass" | "gate_fail" | "vulnerability" | "approval" | "upload";
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
  analysis: "Analysis",
  gate_pass: "Quality Gate",
  gate_fail: "Quality Gate",
  vulnerability: "Findings",
  approval: "Approval",
  upload: "Upload",
};

export const EVENT_CSS: Record<EventType, string> = {
  analysis: "event--analysis",
  gate_pass: "event--success",
  gate_fail: "event--danger",
  vulnerability: "event--warning",
  approval: "event--info",
  upload: "event--neutral",
};

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
  if (gateStatus === "fail") return "Gate fail";
  if (gateStatus === "warning") return "Gate warning";
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

  chips.push({ label: `Findings ${total}`, tone: total > 0 ? "neutral" : "success" });
  if (critical > 0) chips.push({ label: `Critical ${critical}`, tone: "critical" });
  if (high > 0) chips.push({ label: `High ${high}`, tone: "high" });
  if (medium > 0) chips.push({ label: `Medium ${medium}`, tone: "medium" });
  if (low > 0) chips.push({ label: `Low ${low}`, tone: "neutral" });
  if ((project.unresolvedDelta ?? 0) > 0) chips.push({ label: `Unresolved +${project.unresolvedDelta}`, tone: "warning" });

  return chips;
}

export function buildActivity(projects: DashboardProject[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const project of projects) {
    const timestamp = project.lastAnalysisAt;

    if (timestamp) {
      events.push({
        id: `${project.id}-analysis`,
        projectId: project.id,
        projectName: project.name,
        type: "analysis",
        description: "정적 분석이 완료되었습니다",
        chips: buildProjectChips(project).slice(0, 5),
        timestamp,
      });
    }

    if (project.gateStatus === "fail" || project.gateStatus === "warning" || project.gateStatus === "pass") {
      events.push({
        id: `${project.id}-gate`,
        projectId: project.id,
        projectName: project.name,
        type: project.gateStatus === "fail" ? "gate_fail" : "gate_pass",
        description: project.gateStatus === "fail" ? "Quality Gate에 실패했습니다" : "Quality Gate를 통과했습니다",
        chips: buildProjectChips(project).slice(0, 3),
        timestamp: timestamp || project.updatedAt,
      });
    }

    const total = totalFindings(project);
    if (total > 0) {
      events.push({
        id: `${project.id}-vulnerability`,
        projectId: project.id,
        projectName: project.name,
        type: "vulnerability",
        description: `취약점 ${total}건이 발견되었습니다`,
        chips: buildProjectChips(project).slice(0, 5),
        timestamp: timestamp || project.updatedAt,
      });
    }
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function recentProjectUpdate(project: DashboardProject): string {
  const timestamp = project.lastAnalysisAt || project.updatedAt;
  return `recent update · ${formatRelativeTime(timestamp)}`;
}

export function attentionDescription(project: DashboardProject): string {
  const total = totalFindings(project);
  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  const medium = project.severitySummary?.medium ?? 0;
  const unresolved = project.unresolvedDelta ?? 0;

  if (critical > 0) {
    return `Critical ${critical}건을 포함해 Findings ${total}건이 확인되었습니다.`;
  }

  if (high > 0) {
    return `High ${high}건을 포함해 Findings ${total}건이 확인되었습니다.`;
  }

  if (medium > 0) {
    return `Medium ${medium}건을 포함해 Findings ${total}건이 확인되었습니다.`;
  }

  if (project.gateStatus === "fail") {
    return "Quality Gate 실패로 추가 확인이 필요합니다.";
  }

  if (project.gateStatus === "warning") {
    return "Quality Gate warning 상태라 점검이 필요합니다.";
  }

  if (unresolved > 0) {
    return `Unresolved 항목이 ${unresolved}건 증가했습니다.`;
  }

  return "최근 변경 내용을 확인하세요.";
}
