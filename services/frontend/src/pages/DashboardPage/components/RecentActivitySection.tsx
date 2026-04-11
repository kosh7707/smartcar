import React from "react";
import { FolderKanban } from "lucide-react";
import type { ActivityEvent } from "../dashboardTypes";
import { ActivityEventCard } from "./ActivityEventCard";
import { DashboardEmptySurface } from "./DashboardEmptySurface";
import "./RecentActivitySection.css";

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
        <h2 className="dashboard-section-heading__title">최근 활동</h2>
      </div>

      {activity.length === 0 ? (
        <DashboardEmptySurface
          icon={<FolderKanban size={22} />}
          title="아직 활동 없음"
          description="첫 업로드, 분석, 승인 같은 작업이 시작되면 최근 흐름이 이 레인에 순서대로 쌓입니다."
          variant="panel"
        />
      ) : (
        <div className="recent-activity-list">
          {visibleActivity.map((event) => <ActivityEventCard key={event.id} event={event} />)}
        </div>
      )}

      {activity.length > visibleActivity.length && (
        <div className="recent-activity-more">
          <button
            type="button"
            className="recent-activity-more__btn"
            onClick={onLoadMore}
          >
            더 보기
          </button>
        </div>
      )}
    </section>
  );
};
