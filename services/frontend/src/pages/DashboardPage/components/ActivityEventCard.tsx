import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Clock3, GitBranch, Play, User } from "lucide-react";
import { formatRelativeTime } from "../../../utils/format";
import type { ActivityEvent } from "../dashboardTypes";

interface ActivityEventCardProps { event: ActivityEvent; }

const ICONS = {
  check: Check,
  alert: AlertTriangle,
  play: Play,
  user: User,
  branch: GitBranch,
  clock: Clock3,
} as const;

export const ActivityEventCard: React.FC<ActivityEventCardProps> = ({ event }) => {
  const Icon = ICONS[event.icon];

  return (
    <Link to={`/projects/${event.projectId}/overview`} className="activity-item">
      <span className={`activity-icon ${event.tone}`}><Icon /></span>
      <div className="activity-content">
        <div className="line" dangerouslySetInnerHTML={{ __html: event.html }} />
        <div className="when"><Clock3 size={12} className="activity-when-icon" />{formatRelativeTime(event.timestamp)}</div>
      </div>
    </Link>
  );
};
