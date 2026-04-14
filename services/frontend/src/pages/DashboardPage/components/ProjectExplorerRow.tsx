import React from "react";
import { Link } from "react-router-dom";
import type { DashboardProject } from "../dashboardTypes";
import { recentProjectUpdate, totalFindings } from "../dashboardProjectSignals";
import "./ProjectExplorerRow.css";

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

export const ProjectExplorerRow: React.FC<ProjectExplorerRowProps> = ({ project }) => {
  const tone = projectRowTone(project);
  const chips = projectChips(project);

  return (
    <li className="project-explorer-list__item">
      <Link
        to={`/projects/${project.id}/overview`}
        className={`project-explorer-row project-explorer-row--${tone}`}
      >
        <div className="project-explorer-row__body">
          <div className="project-explorer-row__topline">
            <span className="project-explorer-row__name" title={project.name}>{project.name}</span>
          </div>
          <p className="project-explorer-row__summary">{healthSummary(project)}</p>
          {chips.length > 0 ? (
            <div className="project-explorer-row__chips" aria-label={`${project.name} 상태 요약`}>
              {chips.map((chip) => (
                <span key={chip} className="project-explorer-row__chip">{chip}</span>
              ))}
            </div>
          ) : null}
          <div className="project-explorer-row__footer project-explorer-row__footer--compact">
            <span className="project-explorer-row__time">{recentProjectUpdate(project)}</span>
          </div>
        </div>
      </Link>
    </li>
  );
};
