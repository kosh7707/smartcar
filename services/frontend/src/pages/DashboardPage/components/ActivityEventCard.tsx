import React from "react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../../utils/format";
import type { ActivityEvent } from "../dashboardTypes";
import { EVENT_LABELS } from "../dashboardTypes";
import "./ActivityEventCard.css";

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
