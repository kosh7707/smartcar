import React from "react";
import { Link } from "react-router-dom";
import type { DashboardProject } from "../dashboardTypes";
import {
  attentionDescription,
  buildAttentionChips,
  gateLabel,
  gateTone,
} from "../dashboardAttention";
import { recentProjectUpdate } from "../dashboardProjectSignals";
import "./AttentionProjectCard.css";

interface AttentionProjectCardProps {
  project: DashboardProject;
}

export const AttentionProjectCard: React.FC<AttentionProjectCardProps> = ({ project }) => {
  const gate = gateTone(project.gateStatus);
  const gateText = gateLabel(project.gateStatus);
  const chips = buildAttentionChips(project);

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
      {chips.length > 0 ? (
        <div className="attention-project-card__chips">
          {chips.map((chip) => (
            <span key={chip.label} className={`attention-project-card__chip attention-project-card__chip--${chip.tone}`}>
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
};
