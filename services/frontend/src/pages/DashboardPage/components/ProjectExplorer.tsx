import React from "react";
import { FolderSearch } from "lucide-react";
import { CreateProjectForm } from "./CreateProjectForm";
import type { DashboardProject } from "../dashboardTypes";
import { ProjectExplorerSearch } from "./ProjectExplorerSearch";
import { ProjectRow } from "./ProjectRow";
import { DashboardEmptySurface } from "./DashboardEmptySurface";
import { getProjectExplorerEmptyState } from "../projectExplorerEmptyState";
import "./ProjectExplorer.css";

interface ProjectExplorerProps {
  projects: DashboardProject[];
  totalProjects: number;
  loading: boolean;
  filter: string;
  showCreate: boolean;
  createName: string;
  createDescription: string;
  onFilterChange: (value: string) => void;
  onToggleCreate: () => void;
  onCreateNameChange: (value: string) => void;
  onCreateDescriptionChange: (value: string) => void;
  onCreate: () => void;
  onCancelCreate: () => void;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  projects,
  totalProjects,
  loading,
  filter,
  showCreate,
  createName,
  createDescription,
  onFilterChange,
  onToggleCreate,
  onCreateNameChange,
  onCreateDescriptionChange,
  onCreate,
  onCancelCreate,
}) => {
  const emptyState = getProjectExplorerEmptyState({
    loading,
    totalProjects,
    filter,
  });
  const shouldRenderEmpty = projects.length === 0 && (!loading || totalProjects === 0);
  const emptyAction = emptyState.actionKind === "clear-filter"
    ? (
      <button
        type="button"
        className="dashboard-empty-surface__action-control"
        onClick={() => onFilterChange("")}
      >
        검색 초기화
      </button>
    )
    : emptyState.actionKind === "start-project"
      ? (
        <button
          type="button"
          className="dashboard-empty-surface__action-control"
          onClick={onToggleCreate}
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
        onToggleCreate={onToggleCreate}
      />

      {showCreate && (
        <CreateProjectForm
          name={createName}
          description={createDescription}
          onNameChange={onCreateNameChange}
          onDescriptionChange={onCreateDescriptionChange}
          onCreate={onCreate}
          onCancel={onCancelCreate}
        />
      )}

      <ul className="project-explorer-list">
        {projects.map((project) => (
          <ProjectRow key={project.id} project={project} />
        ))}

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
