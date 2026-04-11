import React from "react";
import { Plus, Search } from "lucide-react";
import { DashboardSectionHeading } from "./DashboardSectionHeading";

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
      <DashboardSectionHeading
        title="프로젝트 탐색기"
        actions={(
          <button
            type="button"
            className="explorer-create-btn"
            onClick={onToggleCreate}
          >
            <Plus size={13} />
            <span>새 프로젝트</span>
          </button>
        )}
      />

      <div className="dashboard-search">
        <Search size={14} className="dashboard-search__icon" />
        <input
          className="dashboard-search__input"
          type="text"
          placeholder="프로젝트 검색"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        />
      </div>
    </>
  );
};
