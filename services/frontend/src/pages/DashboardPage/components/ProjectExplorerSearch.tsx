import React from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProjectExplorerSearchProps {
  filter: string;
  onFilterChange: (value: string) => void;
  onToggleCreate: () => void;
}

export const ProjectExplorerSearch: React.FC<ProjectExplorerSearchProps> = ({ filter, onFilterChange, onToggleCreate }) => (
  <>
    <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
      <h2 className="m-0 text-lg font-semibold tracking-tight text-foreground">프로젝트 탐색기</h2>
      <div className="inline-flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onToggleCreate}>
          <Plus size={13} />
          <span>새 프로젝트</span>
        </Button>
      </div>
    </div>

    <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-[var(--cds-field)] px-3 transition-colors focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--cds-interactive-subtle)]">
      <Search size={14} className="shrink-0 text-muted-foreground" />
      <Input
        className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        type="text"
        placeholder="프로젝트 검색"
        value={filter}
        onChange={(event) => onFilterChange(event.target.value)}
      />
    </div>
  </>
);
