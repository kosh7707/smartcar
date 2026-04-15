import React from "react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../../utils/format";
import type { ActivityEvent } from "../dashboardTypes";

interface ActivityEventCardProps {
  event: ActivityEvent;
}

export const ActivityEventCard: React.FC<ActivityEventCardProps> = ({ event }) => (
  <Link
    to={`/projects/${event.projectId}/overview`}
    className="flex items-start justify-between gap-3 border-b border-border px-2 py-3 text-inherit no-underline transition-colors first:border-t hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary max-sm:flex-col"
  >
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-base font-semibold text-foreground">{event.projectName}</span>
      <p className="m-0 text-xs leading-normal text-muted-foreground">{event.description}</p>
    </div>
    <span className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">{formatRelativeTime(event.timestamp)}</span>
  </Link>
);
