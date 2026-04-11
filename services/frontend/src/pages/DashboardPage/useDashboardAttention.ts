import { useMemo } from "react";
import { hasAttentionProjectContext, selectAttentionProjects } from "./dashboardAttentionSelection";
import type { DashboardProject } from "./dashboardTypes";

interface UseDashboardAttentionOptions {
  projects: DashboardProject[];
  filteredProjects: DashboardProject[];
}

export function useDashboardAttention({
  projects,
  filteredProjects,
}: UseDashboardAttentionOptions) {
  const attentionProjects = useMemo(() => selectAttentionProjects(projects), [projects]);
  const hasProjectContext = useMemo(
    () => hasAttentionProjectContext(attentionProjects, filteredProjects, projects),
    [attentionProjects, filteredProjects, projects],
  );

  return {
    attentionProjects,
    hasProjectContext,
  };
}
