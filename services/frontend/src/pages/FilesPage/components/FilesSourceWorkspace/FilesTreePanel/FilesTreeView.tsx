import React, { useCallback, useMemo } from "react";
import { Eye, FileText } from "lucide-react";
import type { Finding } from "@aegis/shared";
import { FileTreeNode } from "../../../../../shared/ui";
import type { TreeNode } from "../../../../../utils/tree";
import { computeFindingOverlay, getFindingCount } from "../../../../../utils/findingOverlay";
import type { DirFindingCount } from "../../../../../utils/findingOverlay";
import { getLangColorByName } from "../../../../../constants/languages";
import { parseLocation } from "../../../../../utils/location";
import type { SourceFileEntry, TargetMappingEntry } from "../../../../../api/client";

interface FilesTreeViewProps {
  displayTree: TreeNode<SourceFileEntry>;
  selectedPath: string | null;
  onClickFile: (data: SourceFileEntry) => void;
  onPreviewFile: (path: string) => void;
  openPaths: Set<string>;
  onToggleFolder: (path: string, open: boolean) => void;
  targetMapping: Record<string, TargetMappingEntry>;
  findings: Finding[];
  searchOpen: boolean;
}

type SeverityCounts = { critical: number; high: number; medium: number; low: number };

const EMPTY_SEVERITY_COUNTS: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

export const FilesTreeView: React.FC<FilesTreeViewProps> = ({
  displayTree,
  selectedPath,
  onClickFile,
  onPreviewFile,
  openPaths,
  onToggleFolder,
  targetMapping,
  findings,
  searchOpen,
}) => {
  const overlay = useMemo<Map<string, DirFindingCount>>(
    () => (findings.length > 0 ? computeFindingOverlay(findings) : new Map()),
    [findings],
  );

  const severityByFile = useMemo(() => {
    const map = new Map<string, SeverityCounts>();
    for (const finding of findings) {
      const { fileName } = parseLocation(finding.location);
      if (!fileName) continue;
      const sev = finding.severity;
      if (sev === "info") continue;
      const prev = map.get(fileName) ?? { ...EMPTY_SEVERITY_COUNTS };
      prev[sev as keyof SeverityCounts] += 1;
      map.set(fileName, prev);
    }
    return map;
  }, [findings]);

  const renderFileIcon = useCallback(
    (data: SourceFileEntry) => (
      <FileText size={14} className="ftree-file-icon" style={{ color: getLangColorByName(data.language) }} />
    ),
    [],
  );

  const renderFileMeta = useCallback(
    (data: SourceFileEntry) => {
      const target = targetMapping[data.relativePath];
      const counts = severityByFile.get(data.relativePath);
      const hasCounts =
        counts !== undefined && (counts.critical || counts.high || counts.medium || counts.low) > 0;
      if (!target && !hasCounts) return null;
      return (
        <span className="ftree-tags">
          {target ? (
            <span className="ftree-target" title={target.targetName}>
              <span className="ftree-target-dot" aria-hidden="true" />
              <span className="ftree-target-name">{target.targetName}</span>
            </span>
          ) : null}
          {counts && hasCounts ? (
            <span className="ftree-finding-cluster" aria-label="finding 개수">
              {(["critical", "high", "medium", "low"] as Array<keyof SeverityCounts>).map((sev) =>
                counts[sev] > 0 ? (
                  <span key={sev} className={`ftree-finding-dot ftree-finding-dot--${sev}`}>
                    {counts[sev]}
                  </span>
                ) : null,
              )}
            </span>
          ) : null}
        </span>
      );
    },
    [severityByFile, targetMapping],
  );

  const renderFolderBadge = useCallback(
    (node: TreeNode<SourceFileEntry>) => {
      const counts = getFindingCount(node.path, overlay);
      if (counts.total === 0) return null;
      return (
        <span className="ftree-folder-badge">
          {counts.critical > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--critical">{counts.critical}</span>
          )}
          {counts.high > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--high">{counts.high}</span>
          )}
          {counts.medium > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--medium">{counts.medium}</span>
          )}
          {counts.low > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--low">{counts.low}</span>
          )}
        </span>
      );
    },
    [overlay],
  );

  const renderActions = useCallback(
    (data: SourceFileEntry) => (
      <button
        type="button"
        className="files-tree-eye-btn"
        onClick={(event) => {
          event.stopPropagation();
          onPreviewFile(data.relativePath);
        }}
        aria-label={`${data.relativePath} 미리 보기`}
        title="미리 보기"
      >
        <Eye size={13} />
      </button>
    ),
    [onPreviewFile],
  );

  return (
    <div className="panel-body files-workspace-panel-body">
      <div className="scroll-area files-workspace-tree files-tree-panel__scroll">
        <div className="files-workspace-tree-inner files-tree-panel__inner">
          {displayTree.children.length === 0 ? (
            <div className="files-workspace-tree-empty">검색 결과가 없습니다</div>
          ) : (
            displayTree.children.map((node) => (
              <FileTreeNode<SourceFileEntry>
                key={node.path}
                node={node}
                depth={0}
                searchOpen={searchOpen}
                onClickFile={onClickFile}
                renderFileIcon={renderFileIcon}
                renderFileMeta={renderFileMeta}
                renderActions={renderActions}
                renderFolderBadge={renderFolderBadge}
                selectedPath={selectedPath ?? undefined}
                openPaths={openPaths}
                onToggleFolder={onToggleFolder}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
