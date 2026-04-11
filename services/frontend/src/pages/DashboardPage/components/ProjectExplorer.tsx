import React from "react";
import { CreateProjectForm } from "./CreateProjectForm";
import { DashboardProject } from "../dashboardModel";
import { ProjectExplorerSearch } from "./ProjectExplorerSearch";
import { ProjectExplorerEmpty } from "./ProjectExplorerEmpty";
import { ProjectRow } from "./ProjectRow";

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

interface ExplorerEmptyState {
  title: string;
  description: string;
  action?: React.ReactNode;
}

function getEmptyState(
  loading: boolean,
  totalProjects: number,
  filter: string,
  onFilterChange: (value: string) => void,
  onToggleCreate: () => void,
): ExplorerEmptyState {
  if (loading && totalProjects === 0) {
    return {
      title: "프로젝트 목록을 불러오는 중",
      description: "최근 작업 공간과 상태를 불러와 Explorer를 준비하고 있습니다.",
    };
  }

  if (filter.trim()) {
    return {
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
    };
  }

  if (totalProjects === 0) {
    return {
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
    };
  }

  return {
    title: "표시할 프로젝트가 없습니다",
    description: "현재 조건에서 Explorer에 표시할 항목이 없습니다.",
  };
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
  const emptyState = getEmptyState(loading, totalProjects, filter, onFilterChange, onToggleCreate);
  const shouldRenderEmpty = projects.length === 0 && (!loading || totalProjects === 0);

  return (
    <aside className="dashboard-explorer" aria-label="프로젝트 탐색기">
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

      <ul className="project-list">
        {projects.map((project) => (
          <ProjectRow key={project.id} project={project} />
        ))}

        {shouldRenderEmpty ? (
          <ProjectExplorerEmpty
            title={emptyState.title}
            description={emptyState.description}
            action={loading ? undefined : emptyState.action}
          />
        ) : null}
      </ul>
    </aside>
  );
};
