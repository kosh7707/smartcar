import React from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { DashboardSectionEmpty } from "./DashboardSectionEmpty";
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
        <DashboardSectionEmpty
          tone="attention"
          icon={<Shield size={22} />}
          title="No urgent items"
          description={
            nextMoveProject
              ? "지금은 즉시 대응할 경고가 없습니다. 최근 프로젝트 상태를 한 번 점검해두면 충분합니다."
              : "프로젝트를 생성하면 게이트 실패나 높은 위험 항목이 이곳에 우선 정렬됩니다."
          }
        />
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
