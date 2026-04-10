import React from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
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
            {filter.trim() ? "검색 조건에 맞는 프로젝트가 없습니다." : totalProjects === 0 ? "프로젝트를 먼저 생성하세요." : "표시할 프로젝트가 없습니다."}
          </li>
        )}
        {loading && totalProjects === 0 && <li className="project-list__empty">프로젝트 목록을 불러오는 중입니다…</li>}
      </ul>
    </aside>
  );
};
