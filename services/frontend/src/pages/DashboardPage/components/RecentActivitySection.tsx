import React from "react";
import { Link } from "react-router-dom";
import { FolderKanban } from "lucide-react";
import { formatRelativeTime } from "../../../utils/format";
import { ActivityEvent, EVENT_CSS, EVENT_LABELS } from "../dashboardModel";

interface RecentActivitySectionProps {
  activity: ActivityEvent[];
  visibleActivity: ActivityEvent[];
  onLoadMore: () => void;
}

export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  activity,
  visibleActivity,
  onLoadMore,
}) => {
  return (
    <section className="dashboard-section dashboard-section--activity">
      <div className="dashboard-section-heading">
        <h2 className="dashboard-section-heading__title">Recent activity</h2>
      </div>

      {activity.length === 0 ? (
        <div className="dashboard-empty-state">
          <FolderKanban size={24} />
          <div>
            <strong>No activity yet</strong>
            <span className="dashboard-empty-state__hint">분석이 시작되면 이곳에 기록됩니다.</span>
          </div>
        </div>
      ) : (
        <div className="activity-list activity-list--boxed">
          {visibleActivity.map((event) => (
            <Link key={event.id} to={`/projects/${event.projectId}/overview`} className={`activity-card ${EVENT_CSS[event.type]}`}>
              <div className="activity-card__body">
                <div className="activity-card__head">
                  <div className="activity-card__head-left">
                    <span className="activity-card__project">{event.projectName}</span>
                    <span className={`activity-card__type activity-card__type--${event.type}`}>
                      {EVENT_LABELS[event.type]}
                    </span>
                  </div>
                  <span className="activity-card__time">{formatRelativeTime(event.timestamp)}</span>
                </div>
                <p className="activity-card__description">{event.description}</p>
                {event.chips && event.chips.length > 0 ? (
                  <div className="activity-card__chips">
                    {event.chips.map((chip) => (
                      <span key={chip.label} className={`dashboard-chip dashboard-chip--${chip.tone} dashboard-chip--compact`}>
                        {chip.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}

      {activity.length > visibleActivity.length && (
        <div className="activity-more">
          <button
            type="button"
            className="activity-more__btn"
            onClick={onLoadMore}
          >
            More
          </button>
        </div>
      )}
    </section>
  );
};
