import { useMemo, useState } from "react";
import type { ActivityEvent } from "./dashboardTypes";

interface UseDashboardActivityFeedOptions {
  activity: ActivityEvent[];
  pageSize?: number;
}

export function useDashboardActivityFeed({
  activity,
  pageSize = 10,
}: UseDashboardActivityFeedOptions) {
  const [visibleActivityCount, setVisibleActivityCount] = useState(pageSize);

  const visibleActivity = useMemo(
    () => activity.slice(0, visibleActivityCount),
    [activity, visibleActivityCount],
  );

  const loadMore = () => setVisibleActivityCount((count) => count + pageSize);

  return {
    visibleActivity,
    loadMore,
  };
}
