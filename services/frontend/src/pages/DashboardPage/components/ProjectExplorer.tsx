import React from "react";
import { Link } from "react-router-dom";
import { FolderSearch, Plus, Search } from "lucide-react";
import { CreateProjectForm } from "./CreateProjectForm";
import { DashboardProject, projectRowAccentClass, recentProjectUpdate } from "../dashboardModel";

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
  const emptyState = loading && totalProjects === 0
    ? {
      title: "프로젝트 목록을 불러오는 중",
      description: "최근 작업 공간과 상태를 불러와 Explorer를 준비하고 있습니다.",
      action: null as React.ReactNode,
    }
    : filter.trim()
      ? {
        title: "검색 결과가 없습니다",
        description: `“${filter.trim()}”와 일치하는 프로젝트가 없습니다. 검색어를 줄이거나 초기화해보세요.`,
        action: (
          <button
            type="button"
            className="project-list__empty-action"
            onClick={() => onFilterChange("")}
          >
            검색 초기화
          </button>
        ),
      }
      : totalProjects === 0
        ? {
          title: "아직 프로젝트가 없습니다",
          description: "첫 프로젝트를 만들면 이곳에서 상태와 최근 흐름을 바로 탐색할 수 있습니다.",
          action: (
            <button
              type="button"
              className="project-list__empty-action"
              onClick={onToggleCreate}
            >
              새 프로젝트 시작
            </button>
          ),
        }
        : {
          title: "표시할 프로젝트가 없습니다",
          description: "현재 조건에서 Explorer에 표시할 항목이 없습니다.",
          action: null as React.ReactNode,
        };

  return (
    <aside className="dashboard-explorer" aria-label="Project explorer">
      <div className="dashboard-section-heading">
        <h2 className="dashboard-section-heading__title">Project explorer</h2>
        <div className="dashboard-section-heading__actions">
          <button
            type="button"
            className="explorer-create-btn"
            onClick={onToggleCreate}
          >
            <Plus size={13} />
            <span>New</span>
          </button>
        </div>
      </div>

      <div className="dashboard-search">
        <Search size={14} className="dashboard-search__icon" />
        <input
          className="dashboard-search__input"
          type="text"
          placeholder="Search projects"
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

      <ul className="project-list">
        {projects.map((project) => (
          <li key={project.id} className="project-list__item">
            <Link
              to={`/projects/${project.id}/overview`}
              className={`project-row ${projectRowAccentClass(project)}`}
            >
              <div className="project-row__body">
                <div className="project-row__topline">
                  <span className="project-row__name" title={project.name}>{project.name}</span>
                </div>
                <div className="project-row__footer project-row__footer--compact">
                  <span className="project-row__time">{recentProjectUpdate(project)}</span>
                </div>
              </div>
            </Link>
          </li>
        ))}

        {!loading && projects.length === 0 && (
          <li className="project-list__empty">
            <div className="project-list__empty-surface">
              <div className="project-list__empty-icon">
                <FolderSearch size={18} />
              </div>
              <div className="project-list__empty-copy">
                <strong className="project-list__empty-title">{emptyState.title}</strong>
                <p className="project-list__empty-description">{emptyState.description}</p>
                {emptyState.action ? (
                  <div className="project-list__empty-actions">{emptyState.action}</div>
                ) : null}
              </div>
            </div>
          </li>
        )}
        {loading && totalProjects === 0 && (
          <li className="project-list__empty">
            <div className="project-list__empty-surface">
              <div className="project-list__empty-icon">
                <FolderSearch size={18} />
              </div>
              <div className="project-list__empty-copy">
                <strong className="project-list__empty-title">{emptyState.title}</strong>
                <p className="project-list__empty-description">{emptyState.description}</p>
              </div>
            </div>
          </li>
        )}
      </ul>
    </aside>
  );
};
