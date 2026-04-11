import { useMemo, useState } from "react";
import type { DashboardProject } from "./dashboardTypes";

interface UseDashboardExplorerFilterOptions {
  projects: DashboardProject[];
}

export function useDashboardExplorerFilter({ projects }: UseDashboardExplorerFilterOptions) {
  const [filter, setFilter] = useState("");

  const filteredProjects = useMemo(() => {
    if (!filter.trim()) return projects;
    const query = filter.toLowerCase();
    return projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(query));
  }, [projects, filter]);

  return {
    filter,
    setFilter,
    filteredProjects,
  };
}
