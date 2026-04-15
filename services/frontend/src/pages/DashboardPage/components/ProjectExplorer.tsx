import React from "react";
import { Button } from "@/components/ui/button";
import { CreateProjectForm } from "./CreateProjectForm";
import type { DashboardProject } from "../dashboardTypes";
import { DashboardEmptySurface } from "./DashboardEmptySurface";
import type { ProjectExplorerEmptyState } from "../hooks/useDashboardExplorerState";
import { ProjectExplorerRow } from "./ProjectExplorerRow";
import { ProjectExplorerSearch } from "./ProjectExplorerSearch";

export interface DashboardExplorerCreateFlow {
  show: boolean;
  name: string;
  description: string;
  onToggle: () => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

interface ProjectExplorerProps {
  projects: DashboardProject[];
  filter: string;
  emptyState: ProjectExplorerEmptyState;
  onFilterChange: (value: string) => void;
  createFlow: DashboardExplorerCreateFlow;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  projects,
  filter,
  emptyState,
  onFilterChange,
  createFlow,
}) => {
  const shouldRenderEmpty = projects.length === 0;
  const emptyAction = emptyState.actionKind === "clear-filter"
    ? <Button type="button" variant="outline" size="sm" onClick={() => onFilterChange("")}>검색 초기화</Button>
    : emptyState.actionKind === "start-project"
      ? <Button type="button" variant="outline" size="sm" onClick={createFlow.onToggle}>새 프로젝트 시작</Button>
      : undefined;

  return (
    <aside className="sticky top-[calc(60px+var(--cds-spacing-05))] flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-background/80 p-5 text-foreground max-[980px]:static" aria-label="프로젝트 탐색기">
      <ProjectExplorerSearch
        filter={filter}
        onFilterChange={onFilterChange}
        onToggleCreate={createFlow.onToggle}
      />

      {createFlow.show && (
        <CreateProjectForm
          name={createFlow.name}
          description={createFlow.description}
          onNameChange={createFlow.onNameChange}
          onDescriptionChange={createFlow.onDescriptionChange}
          onCreate={createFlow.onSubmit}
          onCancel={createFlow.onCancel}
        />
      )}

      <ul className="m-0 flex list-none flex-col p-0 pb-1">
        {projects.map((project) => <ProjectExplorerRow key={project.id} project={project} />)}

        {shouldRenderEmpty ? (
          <li className="py-5">
            <DashboardEmptySurface
              title={emptyState.title}
              description={emptyState.description}
              action={emptyAction}
              variant="inline"
            />
          </li>
        ) : null}
      </ul>
    </aside>
  );
};
