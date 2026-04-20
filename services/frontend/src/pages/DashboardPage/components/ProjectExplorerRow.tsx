import React from "react";
import { Link } from "react-router-dom";
import type { DashboardProject } from "../dashboardTypes";
import { recentProjectUpdate, totalFindings } from "../dashboardProjectSignals";

interface ProjectExplorerRowProps {
  project: DashboardProject;
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

export const ProjectExplorerRow: React.FC<ProjectExplorerRowProps> = ({ project }) => (
  <li>
    <Link to={`/projects/${project.id}/overview`} className="dashboard-explorer-row">
      <div>
        <div className="dashboard-explorer-title">{project.name}</div>
        <div className="dashboard-explorer-copy">{healthSummary(project)}</div>
      </div>
      <div className="dashboard-explorer-meta">{recentProjectUpdate(project)}</div>
    </Link>
  </li>
);
