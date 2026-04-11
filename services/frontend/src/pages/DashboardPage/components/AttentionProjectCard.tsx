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
  const chips = buildProjectChips(project).slice(0, 3);

  return (
    <Link to={`/projects/${project.id}/overview`} className="attention-project-card">
      <div className="attention-project-card__header">
        {gate && gateText ? (
          <span className={`attention-project-card__gate attention-project-card__gate--${gate}`}>{gateText}</span>
        ) : null}
        <span className="attention-project-card__time">{recentProjectUpdate(project)}</span>
      </div>
      <span className="attention-project-card__project">{project.name}</span>
      <p className="attention-project-card__description">{attentionDescription(project)}</p>
      {chips.length > 0 ? <DashboardChipList chips={chips} /> : null}
    </Link>
  );
};
