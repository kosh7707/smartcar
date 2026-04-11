import React from "react";
import { FolderKanban } from "lucide-react";
import { ActivityEvent } from "../dashboardModel";
import { ActivityEventCard } from "./ActivityEventCard";
import { DashboardSectionEmpty } from "./DashboardSectionEmpty";
import { DashboardSectionHeading } from "./DashboardSectionHeading";

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
      <DashboardSectionHeading title="최근 활동" />

      {activity.length === 0 ? (
        <DashboardSectionEmpty
          icon={<FolderKanban size={22} />}
          title="아직 활동 없음"
          description="첫 업로드, 분석, 승인 같은 작업이 시작되면 최근 흐름이 이 레인에 순서대로 쌓입니다."
        />
      ) : (
        <div className="activity-list">
          {visibleActivity.map((event) => <ActivityEventCard key={event.id} event={event} />)}
        </div>
      )}

      {activity.length > visibleActivity.length && (
        <div className="activity-more">
          <button
            type="button"
            className="activity-more__btn"
            onClick={onLoadMore}
          >
            더 보기
          </button>
        </div>
      )}
    </section>
  );
};
