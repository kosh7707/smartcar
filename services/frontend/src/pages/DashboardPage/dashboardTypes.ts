import type { ProjectListItem } from "@aegis/shared";

export type DashboardProject = ProjectListItem;

export type ActivityTone = "success" | "critical" | "primary" | "muted";
export type ActivityIcon = "check" | "alert" | "play" | "user" | "branch" | "clock";

export interface ActivityEvent {
  id: string;
  projectId: string;
  projectName: string;
  timestamp: string;
  tone: ActivityTone;
  icon: ActivityIcon;
  html: string;
}
