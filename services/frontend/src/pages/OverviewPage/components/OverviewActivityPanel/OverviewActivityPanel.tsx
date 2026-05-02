import "./OverviewActivityPanel.css";
import React from "react";
import { Activity } from "lucide-react";
import type { ActivityEntry } from "@/common/api/projects";
import { formatDateTime } from "@/common/utils/format";
import { OverviewSectionHeader } from "../OverviewSectionHeader/OverviewSectionHeader";

interface OverviewActivityPanelProps {
  activities: ActivityEntry[];
}

export const OverviewActivityPanel: React.FC<OverviewActivityPanelProps> = ({ activities }) => (
  <section className="overview-activity-panel">
    <OverviewSectionHeader title="최근 활동" />
    <div className="panel overview-activity-panel__card">
      {activities.length === 0 ? (
        <div className="overview-activity-panel__empty-wrap">
          <p className="overview-activity-panel__empty">아직 활동 이력이 없습니다.</p>
        </div>
      ) : (
        <div className="scroll-area overview-activity-panel__scroll">
          <div className="overview-activity-panel__list">
            {activities.map((activity, index) => (
              <div
                key={`${activity.timestamp}-${index}`}
                className="overview-activity-panel__item"
              >
                <div className="overview-activity-panel__item-main">
                  <div className="overview-activity-panel__item-icon">
                    <Activity size={14} />
                  </div>
                  <span className="overview-activity-panel__item-text">{activity.summary}</span>
                </div>
                <span className="overview-activity-panel__item-time">
                  {formatDateTime(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </section>
);
