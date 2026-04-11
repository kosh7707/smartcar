import type { ProjectListItem } from "@aegis/shared";

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
