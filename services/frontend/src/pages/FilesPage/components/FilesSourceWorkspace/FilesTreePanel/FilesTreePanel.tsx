import "./FilesTreePanel.css";
import React from "react";
import type { Finding } from "@aegis/shared";
import type { TreeNode } from "@/common/utils/tree";
import type { SourceFileEntry } from "@/common/api/client";
import { FilesTreePanelHeader } from "./FilesTreePanelHeader/FilesTreePanelHeader";
import { FilesTreeView } from "./FilesTreeView/FilesTreeView";

interface FilesTreePanelProps {
  search: string;
  onSearchChange: (value: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  displayTree: TreeNode<SourceFileEntry>;
  selectedPath: string | null;
  onClickFile: (data: SourceFileEntry) => void;
  onPreviewFile: (path: string) => void;
  openPaths: Set<string>;
  onToggleFolder: (path: string, open: boolean) => void;
  findings: Finding[];
}

export const FilesTreePanel: React.FC<FilesTreePanelProps> = ({
  search,
  onSearchChange,
  onExpandAll,
  onCollapseAll,
  displayTree,
  selectedPath,
  onClickFile,
  onPreviewFile,
  openPaths,
  onToggleFolder,
  findings,
}) => {
  const searchOpen = search.trim().length > 0;

  return (
    <div className="panel files-workspace-panel files-tree-panel">
      <FilesTreePanelHeader
        search={search}
        onSearchChange={onSearchChange}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
      />
      <FilesTreeView
        displayTree={displayTree}
        selectedPath={selectedPath}
        onClickFile={onClickFile}
        onPreviewFile={onPreviewFile}
        openPaths={openPaths}
        onToggleFolder={onToggleFolder}
        findings={findings}
        searchOpen={searchOpen}
      />
    </div>
  );
};
