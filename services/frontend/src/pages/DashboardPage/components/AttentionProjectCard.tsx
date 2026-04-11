import React from "react";
import { Link } from "react-router-dom";
import type { DashboardProject } from "../dashboardModel";
import {
  attentionDescription,
  buildProjectChips,
  gateLabel,
  gateTone,
  recentProjectUpdate,
} from "../dashboardModel";
import { DashboardChipList } from "./DashboardChipList";
import "./AttentionProjectCard.css";

interface AttentionProjectCardProps {
  project: DashboardProject;
}

export const AttentionProjectCard: React.FC<AttentionProjectCardProps> = ({ project }) => {
  const gate = gateTone(project.gateStatus);
  const gateText = gateLabel(project.gateStatus);
  const chips = buildProjectChips(project).slice(0, 4);

  return (
    <Link to={`/projects/${project.id}/overview`} className="attention-project-card">
      <div className="attention-project-card__meta">
        <div className="attention-project-card__title-row">
          <span className="attention-project-card__project">{project.name}</span>
          {gate && gateText ? (
            <span className={`attention-project-card__gate attention-project-card__gate--${gate}`}>{gateText}</span>
          ) : null}
        </div>
        <span className="attention-project-card__time">{recentProjectUpdate(project)}</span>
      </div>
      <p className="attention-project-card__description">{attentionDescription(project)}</p>
      <DashboardChipList chips={chips} />
    </Link>
  );
};
