import type { ProjectListItem } from "@aegis/shared";

export type EventType = "analysis" | "gate_pass" | "gate_fail" | "gate_warning" | "vulnerability" | "approval" | "upload";

export type DashboardProject = ProjectListItem;

export interface ActivityEvent {
  id: string;
  projectId: string;
  projectName: string;
  type: EventType;
  description: string;
  timestamp: string;
}
