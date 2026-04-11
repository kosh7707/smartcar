import React from "react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../../utils/format";
import type { ActivityEvent } from "../dashboardTypes";
import "./ActivityEventCard.css";

const EVENT_LABELS: Record<ActivityEvent["type"], string> = {
  analysis: "분석 완료",
  gate_pass: "게이트 통과",
  gate_fail: "게이트 실패",
  gate_warning: "게이트 경고",
  vulnerability: "취약점",
  approval: "승인",
  upload: "업로드",
};

interface ActivityEventCardProps {
  event: ActivityEvent;
}

export const ActivityEventCard: React.FC<ActivityEventCardProps> = ({ event }) => (
  <Link to={`/projects/${event.projectId}/overview`} className="activity-event-card">
    <div className="activity-event-card__meta">
      <span className={`activity-event-card__type activity-event-card__type--${event.type}`}>
        {EVENT_LABELS[event.type]}
      </span>
      <span className="activity-event-card__time">{formatRelativeTime(event.timestamp)}</span>
    </div>
    <div className="activity-event-card__summary">
      <span className="activity-event-card__project">{event.projectName}</span>
      <p className="activity-event-card__description">{event.description}</p>
    </div>
  </Link>
);
