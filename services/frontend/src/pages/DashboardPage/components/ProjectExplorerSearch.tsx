import React from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProjectExplorerSearchProps {
  filter: string;
  onFilterChange: (value: string) => void;
  onToggleCreate: () => void;
}

export const ProjectExplorerSearch: React.FC<ProjectExplorerSearchProps> = ({ filter, onFilterChange, onToggleCreate }) => (
  <div className="dashboard-search-row">
    <div className="search-inline dashboard-search-inline">
      <Search aria-hidden="true" />
      <input type="search" placeholder="프로젝트 검색" value={filter} onChange={(event) => onFilterChange(event.target.value)} />
    </div>
    <Button type="button" variant="outline" size="sm" onClick={onToggleCreate}>
      <Plus size={13} />
      <span>새 프로젝트</span>
    </Button>
  </div>
);
