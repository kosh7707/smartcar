import React from "react";
import { FolderSearch } from "lucide-react";
import { CreateProjectForm } from "./CreateProjectForm";
import type { DashboardProject } from "../dashboardTypes";
import { DashboardEmptySurface } from "./DashboardEmptySurface";
import { getDashboardExplorerEmptyState } from "../dashboardExplorerEmptyState";
import { ProjectExplorerRow } from "./ProjectExplorerRow";
import { ProjectExplorerSearch } from "./ProjectExplorerSearch";
import "./ProjectExplorer.css";

interface ProjectExplorerProps {
  projects: DashboardProject[];
  totalProjects: number;
  loading: boolean;
  filter: string;
  onFilterChange: (value: string) => void;
  createFlow: {
    show: boolean;
    name: string;
    description: string;
    onToggle: () => void;
    onNameChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
  };
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  projects,
  totalProjects,
  loading,
  filter,
  onFilterChange,
  createFlow,
}) => {
  const emptyState = getDashboardExplorerEmptyState({
    loading,
    totalProjects,
    filter,
  });
  const shouldRenderEmpty = projects.length === 0 && (!loading || totalProjects === 0);
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
              icon={<FolderSearch size={18} />}
              title={emptyState.title}
              description={emptyState.description}
              action={loading ? undefined : emptyAction}
              variant="inline"
            />
          </li>
        ) : null}
      </ul>
    </aside>
  );
};
