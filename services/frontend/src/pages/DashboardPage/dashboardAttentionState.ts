import type { DashboardProject } from "./dashboardTypes";
import { unresolvedFindings } from "./dashboardProjectSignals";

interface UseDashboardAttentionOptions {
  projects: DashboardProject[];
  filteredProjects: DashboardProject[];
}

export function getDashboardAttentionState({ projects, filteredProjects }: UseDashboardAttentionOptions) {
  const attentionProjects = selectAttentionProjects(projects);
  const hasProjectContext = hasAttentionProjectContext(attentionProjects, filteredProjects, projects);

  return {
    attentionProjects,
    hasProjectContext,
  };
}

function selectAttentionProjects(projects: DashboardProject[], limit = 3): DashboardProject[] {
  return [...projects]
    .sort((a, b) => projectPriorityForAttention(b) - projectPriorityForAttention(a))
    .filter((project) => projectPriorityForAttention(project) > 0)
    .slice(0, limit);
}

function hasAttentionProjectContext(attentionProjects: DashboardProject[], filteredProjects: DashboardProject[], allProjects: DashboardProject[]): boolean {
  return Boolean(attentionProjects[0] ?? filteredProjects[0] ?? allProjects[0]);
}

function projectPriorityForAttention(project: DashboardProject): number {
  const critical = project.severitySummary?.critical ?? 0;
  const high = project.severitySummary?.high ?? 0;
  const medium = project.severitySummary?.medium ?? 0;
  const unresolved = unresolvedFindings(project);
  const gatePenalty = project.gateStatus === "fail" ? 40 : project.gateStatus === "warning" || project.gateStatus === "running" ? 18 : 0;
  return critical * 100 + high * 20 + medium * 5 + unresolved + gatePenalty;
}
