import React from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "./ProjectExplorerSearch.css";

interface ProjectExplorerSearchProps {
  filter: string;
  onFilterChange: (value: string) => void;
  onToggleCreate: () => void;
}

export const ProjectExplorerSearch: React.FC<ProjectExplorerSearchProps> = ({ filter, onFilterChange, onToggleCreate }) => (
  <>
    <div className="dashboard-section-heading">
      <h2 className="dashboard-section-heading__title">프로젝트 탐색기</h2>
      <div className="dashboard-section-heading__actions">
        <Button type="button" variant="outline" size="sm" className="project-explorer-create-btn" onClick={onToggleCreate}>
          <Plus size={13} />
          <span>새 프로젝트</span>
        </Button>
      </div>
    </div>

    <div className="project-explorer-search">
      <Search size={14} className="project-explorer-search__icon" />
      <Input
        className="project-explorer-search__input border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        type="text"
        placeholder="프로젝트 검색"
        value={filter}
        onChange={(event) => onFilterChange(event.target.value)}
      />
    </div>
  </>
);
