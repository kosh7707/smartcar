import React from "react";
import { ChevronsDownUp, ChevronsUpDown, Search } from "lucide-react";

interface FilesTreePanelHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export const FilesTreePanelHeader: React.FC<FilesTreePanelHeaderProps> = ({
  search,
  onSearchChange,
  onExpandAll,
  onCollapseAll,
}) => {
  return (
    <div className="panel-head files-workspace-head files-tree-panel__head">
      <div className="panel-body">
        <div className="files-workspace-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="파일 검색..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="files-workspace-tools">
          <button
            type="button"
            className="btn btn-ghost btn-icon-sm"
            title="폴더 전부 열기"
            onClick={onExpandAll}
          >
            <ChevronsUpDown size={16} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon-sm"
            title="폴더 전부 접기"
            onClick={onCollapseAll}
          >
            <ChevronsDownUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
