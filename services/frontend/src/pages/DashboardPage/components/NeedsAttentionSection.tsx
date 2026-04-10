import React from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import {
  attentionDescription,
  buildProjectChips,
  DashboardProject,
  gateLabel,
  gateTone,
  recentProjectUpdate,
} from "../dashboardModel";

interface NeedsAttentionSectionProps {
  projects: DashboardProject[];
  nextMoveProject: DashboardProject | null;
}

export const NeedsAttentionSection: React.FC<NeedsAttentionSectionProps> = ({ projects, nextMoveProject }) => {
  return (
    <section className="dashboard-section dashboard-section--attention">
      <div className="dashboard-section-heading">
        <h2 className="dashboard-section-heading__title">Needs attention</h2>
      </div>

      {projects.length === 0 ? (
        <div className="dashboard-empty-state dashboard-empty-state--attention">
          <Shield size={24} />
          <div>
            <strong>No urgent items</strong>
            {nextMoveProject ? (
              <Link to={`/projects/${nextMoveProject.id}/overview`} className="dashboard-inline-link">
                {nextMoveProject.name} 열기
              </Link>
            ) : (
              <span className="dashboard-empty-state__hint">프로젝트를 먼저 생성하세요.</span>
            )}
          </div>
        </div>
      ) : (
        <div className="attention-shelf">
          {projects.map((project) => {
            const gate = gateTone(project.gateStatus);
            const gateText = gateLabel(project.gateStatus);
            const chips = buildProjectChips(project).slice(0, 4);

            return (
              <Link key={project.id} to={`/projects/${project.id}/overview`} className="activity-card activity-card--attention">
                <div className="activity-card__body">
                  <div className="activity-card__head">
                    <div className="activity-card__head-left">
                      <span className="activity-card__project">{project.name}</span>
                      {gate && gateText ? (
                        <span className={`activity-card__type activity-card__type--${gate}`}>{gateText}</span>
                      ) : null}
                    </div>
                    <span className="activity-card__time">{recentProjectUpdate(project)}</span>
                  </div>
                  <p className="activity-card__description">{attentionDescription(project)}</p>
                  <div className="activity-card__chips">
                    {chips.map((chip) => (
                      <span key={chip.label} className={`dashboard-chip dashboard-chip--${chip.tone}`}>
                        {chip.label}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
};
