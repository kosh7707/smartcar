import React from "react";
import { Link } from "react-router-dom";
import type { DashboardProject } from "../dashboardTypes";
import { projectRowAccentClass, recentProjectUpdate } from "../dashboardProjectSignals";

interface ProjectRowProps {
  project: DashboardProject;
}

export const ProjectRow: React.FC<ProjectRowProps> = ({ project }) => {
  return (
    <li className="project-explorer-list__item">
      <Link
        to={`/projects/${project.id}/overview`}
        className={`project-explorer-row ${projectRowAccentClass(project)}`}
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
