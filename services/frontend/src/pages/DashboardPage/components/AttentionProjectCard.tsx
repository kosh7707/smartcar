import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DashboardProject } from "../dashboardTypes";
import { recentProjectUpdate, totalFindings } from "../dashboardProjectSignals";

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

const getGateClass = (gate: "fail" | "warning") =>
  gate === "fail"
    ? "border-[var(--aegis-severity-critical-border)] bg-[var(--aegis-severity-critical-bg)] text-[var(--aegis-severity-critical)]"
    : "border-[var(--aegis-severity-medium-border)] bg-[var(--aegis-severity-medium-bg)] text-[var(--aegis-severity-medium)]";

const getChipClass = (tone: DashboardChipTone) =>
  ({
    neutral: "border-border bg-background/90 text-muted-foreground",
    critical: "border-[var(--aegis-severity-critical-border)] bg-[var(--aegis-severity-critical-bg)] text-[var(--aegis-severity-critical)]",
    high: "border-[var(--aegis-severity-high-border)] bg-[var(--aegis-severity-high-bg)] text-[var(--aegis-severity-high)]",
    medium: "border-[var(--aegis-severity-medium-border)] bg-[var(--aegis-severity-medium-bg)] text-[var(--aegis-severity-medium)]",
    warning: "border-[var(--aegis-severity-medium-border)] bg-[var(--aegis-severity-medium-bg)] text-[var(--aegis-severity-medium)]",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  })[tone];

export const AttentionProjectCard: React.FC<AttentionProjectCardProps> = ({ project }) => {
  const gate = gateTone(project.gateStatus);
  const gateText = gateLabel(project.gateStatus);
  const chips = buildAttentionChips(project);
  return (
    <Link
      to={`/projects/${project.id}/overview`}
      className="flex flex-col gap-2 border-0 border-l-[3px] border-b border-l-[color-mix(in_srgb,var(--aegis-severity-critical)_56%,transparent)] border-b-border bg-transparent py-3 pr-3 pl-4 text-inherit no-underline transition-all hover:translate-x-0.5 hover:border-l-[var(--aegis-severity-critical)] hover:bg-[color-mix(in_srgb,var(--aegis-severity-critical-bg)_42%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
        {gate && gateText ? <Badge variant="outline" className={cn("min-h-6 whitespace-nowrap text-[0.6875rem] font-medium", getGateClass(gate))}>{gateText}</Badge> : null}
        <span className="whitespace-nowrap text-xs text-muted-foreground">{recentProjectUpdate(project)}</span>
      </div>
      <span className="min-w-0 text-base font-semibold text-foreground">{project.name}</span>
      <p className="m-0 text-sm leading-relaxed text-muted-foreground">{attentionDescription(project)}</p>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => <Badge key={chip.label} variant="outline" className={cn("min-h-6 whitespace-nowrap text-[0.6875rem] font-medium", getChipClass(chip.tone))}>{chip.label}</Badge>)}
        </div>
      ) : null}
    </Link>
  );
};
