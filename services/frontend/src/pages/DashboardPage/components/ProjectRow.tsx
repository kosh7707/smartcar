import React from "react";
import { Link } from "react-router-dom";
import type { DashboardProject } from "../dashboardTypes";
import { projectRowAccentClass, recentProjectUpdate } from "../dashboardProjectSignals";

interface ProjectRowProps {
  project: DashboardProject;
}

export const ProjectRow: React.FC<ProjectRowProps> = ({ project }) => {
  return (
    <li className="project-list__item">
      <Link
        to={`/projects/${project.id}/overview`}
        className={`project-row ${projectRowAccentClass(project)}`}
      >
        <div className="project-row__body">
          <div className="project-row__topline">
            <span className="project-row__name" title={project.name}>{project.name}</span>
          </div>
          <div className="project-row__footer project-row__footer--compact">
            <span className="project-row__time">{recentProjectUpdate(project)}</span>
          </div>
        </div>
      </Link>
    </li>
  );
};
