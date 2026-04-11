import React from "react";
import { FolderSearch, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { CreateProjectForm } from "./CreateProjectForm";
import type { DashboardProject } from "../dashboardTypes";
import { DashboardEmptySurface } from "./DashboardEmptySurface";
import { getDashboardExplorerEmptyState } from "../dashboardExplorerEmptyState";
import { projectRowTone, recentProjectUpdate } from "../dashboardProjectSignals";
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

function renderProjectExplorerRow(project: DashboardProject) {
  const tone = projectRowTone(project);

  return (
    <li key={project.id} className="project-explorer-list__item">
      <Link
        to={`/projects/${project.id}/overview`}
        className={`project-explorer-row project-explorer-row--${tone}`}
      >
        <div className="project-explorer-row__body">
          <div className="project-explorer-row__topline">
            <span className="project-explorer-row__name" title={project.name}>{project.name}</span>
          </div>
          <div className="project-explorer-row__footer project-explorer-row__footer--compact">
            <span className="project-explorer-row__time">{recentProjectUpdate(project)}</span>
          </div>
        </div>
      </Link>
    </li>
  );
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
          onClick={onToggleCreate}
        >
          새 프로젝트 시작
        </button>
      )
      : undefined;

  return (
    <aside className="project-explorer" aria-label="프로젝트 탐색기">
      <div className="dashboard-section-heading">
        <h2 className="dashboard-section-heading__title">프로젝트 탐색기</h2>
        <div className="dashboard-section-heading__actions">
          <button
            type="button"
            className="project-explorer-create-btn"
            onClick={onToggleCreate}
          >
            <Plus size={13} />
            <span>새 프로젝트</span>
          </button>
        </div>
      </div>

      <div className="project-explorer-search">
        <Search size={14} className="project-explorer-search__icon" />
        <input
          className="project-explorer-search__input"
          type="text"
          placeholder="프로젝트 검색"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        />
      </div>

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
        {projects.map(renderProjectExplorerRow)}

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
