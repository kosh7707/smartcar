import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { DashboardProject } from "../dashboardTypes";
import { recentProjectUpdate, totalFindings } from "../dashboardProjectSignals";

interface ProjectExplorerRowProps {
  project: DashboardProject;
}

type ProjectExplorerRowTone = "critical" | "high" | "medium" | "pass" | "muted";

function projectRowTone(project: DashboardProject): ProjectExplorerRowTone {
  const summary = project.severitySummary;
  if ((summary?.critical ?? 0) > 0) return "critical";
  if ((summary?.high ?? 0) > 0) return "high";
  if ((summary?.medium ?? 0) > 0) return "medium";
  if (project.gateStatus === "pass") return "pass";
  return "muted";
}

function healthSummary(project: DashboardProject): string {
  const findings = totalFindings(project);
  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  const unresolved = project.unresolvedDelta ?? 0;

  if (critical > 0) return `치명적 ${critical}건 포함 · 탐지 ${findings}건`;
  if (high > 0) return `높음 ${high}건 포함 · 탐지 ${findings}건`;
  if (findings > 0) return `탐지 ${findings}건`;
  if (project.gateStatus === "fail") return "품질 게이트 실패";
  if (project.gateStatus === "warning") return "품질 게이트 경고";
  if (unresolved > 0) return `미해결 ${unresolved}건 증가`;
  return "최근 상태 안정적";
}

function projectChips(project: DashboardProject): string[] {
  const chips: string[] = [];
  const findings = totalFindings(project);

  if (project.gateStatus === "fail") chips.push("게이트 실패");
  else if (project.gateStatus === "warning") chips.push("게이트 경고");
  else if (project.gateStatus === "pass") chips.push("게이트 통과");

  if (findings > 0) chips.push(`탐지 ${findings}`);
  if ((project.unresolvedDelta ?? 0) > 0) chips.push(`미해결 +${project.unresolvedDelta}`);

  return chips.slice(0, 3);
}

const rowHoverTone: Record<ProjectExplorerRowTone, string> = {
  critical: "hover:bg-[color-mix(in_srgb,var(--aegis-severity-critical)_6%,transparent)]",
  high: "hover:bg-[color-mix(in_srgb,var(--aegis-severity-high)_6%,transparent)]",
  medium: "hover:bg-[color-mix(in_srgb,var(--aegis-severity-medium)_6%,transparent)]",
  pass: "hover:bg-emerald-50/70",
  muted: "hover:bg-muted/70",
};

export const ProjectExplorerRow: React.FC<ProjectExplorerRowProps> = ({ project }) => {
  const tone = projectRowTone(project);
  const chips = projectChips(project);

  return (
    <li className="border-b border-border first:border-t">
      <Link
        to={`/projects/${project.id}/overview`}
        className={cn("flex gap-2 rounded-xl py-4 text-inherit no-underline transition-all hover:translate-x-0.5", rowHoverTone[tone])}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-3 max-sm:items-start">
            <span className="block min-w-0 max-w-full truncate text-base font-semibold text-foreground" title={project.name}>{project.name}</span>
          </div>
          <p className="m-0 text-sm leading-normal text-muted-foreground">{healthSummary(project)}</p>
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-2" aria-label={`${project.name} 상태 요약`}>
              {chips.map((chip) => (
                <span key={chip} className="inline-flex min-h-7 items-center rounded-full border border-border bg-background/90 px-2.5 text-sm font-medium text-muted-foreground">{chip}</span>
              ))}
            </div>
          ) : null}
          <div className="flex items-center justify-start gap-3">
            <span className="text-sm text-muted-foreground">{recentProjectUpdate(project)}</span>
          </div>
        </div>
      </Link>
    </li>
  );
};
