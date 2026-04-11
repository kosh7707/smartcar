import React from "react";
import { Link } from "react-router-dom";
import type { DashboardProject } from "../dashboardTypes";
import { recentProjectUpdate } from "../dashboardProjectSignals";
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

export const ProjectExplorerRow: React.FC<ProjectExplorerRowProps> = ({ project }) => {
  const tone = projectRowTone(project);

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
          <div className="project-explorer-row__footer project-explorer-row__footer--compact">
            <span className="project-explorer-row__time">{recentProjectUpdate(project)}</span>
          </div>
        </div>
      </Link>
    </li>
  );
};
