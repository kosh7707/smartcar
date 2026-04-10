import React from "react";
import { Activity } from "lucide-react";
import type { ActivityEntry } from "../../../api/projects";
import { formatDateTime } from "../../../utils/format";
import { OverviewSectionHeader } from "./OverviewSectionHeader";

interface OverviewActivityPanelProps {
  activities: ActivityEntry[];
}

export const OverviewActivityPanel: React.FC<OverviewActivityPanelProps> = ({ activities }) => (
  <div>
    <OverviewSectionHeader title="Recent Activity" />
    <div className="overview-activity-list">
      {activities.length === 0 ? (
        <div className="overview-activity-list__empty">
          <p className="overview-empty-text">아직 활동 이력이 없습니다.</p>
        </div>
      ) : (
        activities.map((activity, index) => (
          <div key={`${activity.timestamp}-${index}`} className="overview-activity-item">
            <div className="overview-activity-item__left">
              <div className="overview-activity-icon">
                <Activity size={14} />
              </div>
              <span className="overview-activity-item__summary">{activity.summary}</span>
            </div>
            <span className="overview-activity-item__time">{formatDateTime(activity.timestamp)}</span>
          </div>
        ))
      )}
    </div>
  </div>
);
