import { useMemo } from "react";
import { selectAttentionProjects, selectNextMoveProject } from "./dashboardProjectSignals";
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
  const nextMoveProject = useMemo(
    () => selectNextMoveProject(attentionProjects, filteredProjects, projects),
    [attentionProjects, filteredProjects, projects],
  );

  return {
    attentionProjects,
    nextMoveProject,
  };
}
