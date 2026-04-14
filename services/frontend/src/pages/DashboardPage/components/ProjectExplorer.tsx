import React from "react";
import { CreateProjectForm } from "./CreateProjectForm";
import type { DashboardProject } from "../dashboardTypes";
import { DashboardEmptySurface } from "./DashboardEmptySurface";
import type { ProjectExplorerEmptyState } from "../hooks/useDashboardExplorerState";
import { ProjectExplorerRow } from "./ProjectExplorerRow";
import { ProjectExplorerSearch } from "./ProjectExplorerSearch";
import "./ProjectExplorer.css";

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
    ? (
      <button
        type="button"
        className="project-explorer-empty-action"
        onClick={() => onFilterChange("")}
      >
        검색 초기화
      </button>
    )
    : emptyState.actionKind === "start-project"
      ? (
        <button
          type="button"
          className="project-explorer-empty-action"
          onClick={createFlow.onToggle}
        >
          새 프로젝트 시작
        </button>
      )
      : undefined;

  return (
    <aside className="project-explorer" aria-label="프로젝트 탐색기">
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

      <ul className="project-explorer-list">
        {projects.map((project) => <ProjectExplorerRow key={project.id} project={project} />)}

        {shouldRenderEmpty ? (
          <li className="project-explorer-list__empty">
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
