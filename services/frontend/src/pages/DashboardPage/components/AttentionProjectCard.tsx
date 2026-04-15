import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { DashboardProject } from "../dashboardTypes";
import { recentProjectUpdate, totalFindings } from "../dashboardProjectSignals";
import "./AttentionProjectCard.css";

interface AttentionProjectCardProps { project: DashboardProject; }
type DashboardChipTone = "neutral" | "critical" | "high" | "medium" | "success" | "warning";
interface DashboardChip { label: string; tone: DashboardChipTone; }

function gateTone(gateStatus?: string | null): "fail" | "warning" | null {
  if (gateStatus === "fail") return "fail";
  if (gateStatus === "warning") return "warning";
  return null;
}
function gateLabel(gateStatus?: string | null): string | null {
  if (gateStatus === "fail") return "게이트 실패";
  if (gateStatus === "warning") return "게이트 경고";
  return null;
}
function attentionDescription(project: DashboardProject): string {
  const total = totalFindings(project);
  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  const medium = project.severitySummary?.medium ?? 0;
  const unresolved = project.unresolvedDelta ?? 0;
  if (critical > 0) return `치명적 ${critical}건을 포함해 탐지 항목 ${total}건이 확인되었습니다.`;
  if (high > 0) return `높음 ${high}건을 포함해 탐지 항목 ${total}건이 확인되었습니다.`;
  if (medium > 0) return `보통 ${medium}건을 포함해 탐지 항목 ${total}건이 확인되었습니다.`;
  if (project.gateStatus === "fail") return "품질 게이트 실패로 추가 확인이 필요합니다.";
  if (project.gateStatus === "warning") return "품질 게이트 경고 상태라 점검이 필요합니다.";
  if (unresolved > 0) return `미해결 항목이 ${unresolved}건 증가했습니다.`;
  return "최근 변경 내용을 확인하세요.";
}
function buildAttentionChips(project: DashboardProject) { return buildProjectChips(project).slice(0, 3); }
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

export const AttentionProjectCard: React.FC<AttentionProjectCardProps> = ({ project }) => {
  const gate = gateTone(project.gateStatus);
  const gateText = gateLabel(project.gateStatus);
  const chips = buildAttentionChips(project);
  return (
    <Link to={`/projects/${project.id}/overview`} className="attention-project-card">
      <div className="attention-project-card__header">
        {gate && gateText ? <Badge variant="outline" className={`attention-project-card__gate attention-project-card__gate--${gate}`}>{gateText}</Badge> : null}
        <span className="attention-project-card__time">{recentProjectUpdate(project)}</span>
      </div>
      <span className="attention-project-card__project">{project.name}</span>
      <p className="attention-project-card__description">{attentionDescription(project)}</p>
      {chips.length > 0 ? (
        <div className="attention-project-card__chips">
          {chips.map((chip) => <Badge key={chip.label} variant="outline" className={`attention-project-card__chip attention-project-card__chip--${chip.tone}`}>{chip.label}</Badge>)}
        </div>
      ) : null}
    </Link>
  );
};
