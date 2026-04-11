import { useMemo, useState } from "react";
import { buildActivity } from "./dashboardActivity";
import type { DashboardProject } from "./dashboardTypes";

interface UseDashboardActivityFeedOptions {
  projects: DashboardProject[];
  pageSize?: number;
}

export function useDashboardActivityFeed({
  projects,
  pageSize = 10,
}: UseDashboardActivityFeedOptions) {
  const [visibleActivityCount, setVisibleActivityCount] = useState(pageSize);
  const activity = useMemo(() => buildActivity(projects), [projects]);

  const visibleActivity = useMemo(
    () => activity.slice(0, visibleActivityCount),
    [activity, visibleActivityCount],
  );

  const loadMore = () => setVisibleActivityCount((count) => count + pageSize);

  return {
    visibleActivity,
    hasMore: activity.length > visibleActivity.length,
    loadMore,
  };
}
