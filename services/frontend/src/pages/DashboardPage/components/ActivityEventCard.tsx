import React from "react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../../utils/format";
import type { ActivityEvent } from "../dashboardModel";
import { EVENT_LABELS } from "../dashboardModel";
import { DashboardChipList } from "./DashboardChipList";
import "./ActivityEventCard.css";

interface ActivityEventCardProps {
  event: ActivityEvent;
}

export const ActivityEventCard: React.FC<ActivityEventCardProps> = ({ event }) => (
  <Link to={`/projects/${event.projectId}/overview`} className="activity-event-card">
    <div className="activity-event-card__meta">
      <div className="activity-event-card__title-row">
        <span className="activity-event-card__project">{event.projectName}</span>
        <span className={`activity-event-card__type activity-event-card__type--${event.type}`}>
          {EVENT_LABELS[event.type]}
        </span>
      </div>
      <span className="activity-event-card__time">{formatRelativeTime(event.timestamp)}</span>
    </div>
    <p className="activity-event-card__description">{event.description}</p>
    {event.chips && event.chips.length > 0 ? <DashboardChipList chips={event.chips} compact /> : null}
  </Link>
);
