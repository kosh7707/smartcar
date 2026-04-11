import React from "react";
import { Plus, Search } from "lucide-react";

interface ProjectExplorerSearchProps {
  filter: string;
  onFilterChange: (value: string) => void;
  onToggleCreate: () => void;
}

export const ProjectExplorerSearch: React.FC<ProjectExplorerSearchProps> = ({
  filter,
  onFilterChange,
  onToggleCreate,
}) => {
  return (
    <>
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
    </>
  );
};
