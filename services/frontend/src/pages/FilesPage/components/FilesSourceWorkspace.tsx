import React from "react";
import { ChevronsDownUp, ChevronsUpDown, Code2, FileText, Layers, Search, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Finding } from "@aegis/shared";
import type { SourceFileEntry } from "../../../api/client";
import { FileTreeNode, Spinner } from "../../../shared/ui";
import type { TreeNode } from "../../../utils/tree";
import { HighlightedCode } from "./HighlightedCode";
import { parseLocation } from "../../../utils/location";

interface FilesSourceWorkspaceProps {
  search: string;
  onSearchChange: (value: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  displayTree: TreeNode<SourceFileEntry>;
  selectedPath: string | null;
  handleFileClick: (data: SourceFileEntry) => void;
  renderFileIcon: (data: SourceFileEntry) => React.ReactNode;
  renderFileMeta: (data: SourceFileEntry) => React.ReactNode;
  renderFolderBadge: (node: TreeNode<SourceFileEntry>) => React.ReactNode;
  previewLoading: boolean;
  previewLang: string;
  previewContent: string | null;
  highlightLines: Set<number>;
  selectedFileFindings: Finding[];
  onSelectFinding: (findingId: string) => void;
  openPaths: Set<string>;
  onToggleFolder: (path: string, open: boolean) => void;
  layoutRef: React.RefObject<HTMLDivElement | null>;
  treePanelWidth: number;
  isResizing: boolean;
  onStartResize: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onNudgeResize: (direction: "left" | "right") => void;
}

export const FilesSourceWorkspace: React.FC<FilesSourceWorkspaceProps> = ({
  search,
  onSearchChange,
  onExpandAll,
  onCollapseAll,
  displayTree,
  selectedPath,
  handleFileClick,
  renderFileIcon,
  renderFileMeta,
  renderFolderBadge,
  previewLoading,
  previewLang,
  previewContent,
  highlightLines,
  selectedFileFindings,
  onSelectFinding,
  openPaths,
  onToggleFolder,
  layoutRef,
  treePanelWidth,
  isResizing,
  onStartResize,
  onNudgeResize,
}) => (
  <div
    ref={layoutRef}
    className="files-workspace-grid"
    data-testid="files-source-workspace"
    style={{ ["--files-tree-panel-width" as string]: `${treePanelWidth}px` } as React.CSSProperties}
  >
    <Card className="files-workspace-panel">
      <CardHeader className="files-workspace-head">
        <CardContent>
          <div className="files-workspace-search">
            <Search size={14} />
            <input type="text" placeholder="파일 검색..." value={search} onChange={(e) => onSearchChange(e.target.value)} />
          </div>
          <div className="files-workspace-tools">
            <Button variant="ghost" size="icon-sm" title="폴더 전부 열기" onClick={onExpandAll}><ChevronsUpDown size={16} /></Button>
            <Button variant="ghost" size="icon-sm" title="폴더 전부 접기" onClick={onCollapseAll}><ChevronsDownUp size={16} /></Button>
          </div>
        </CardContent>
      </CardHeader>
      <CardContent className="files-workspace-panel-body">
        <ScrollArea className="files-workspace-tree">
          <div className="files-workspace-tree-inner">
            {displayTree.children.length === 0 ? (
              <div className="files-workspace-tree-empty">검색 결과가 없습니다</div>
            ) : (
              displayTree.children.map((node) => (
                <FileTreeNode<SourceFileEntry>
                  key={node.path}
                  node={node}
                  depth={0}
                  searchOpen={search.trim().length > 0}
                  onClickFile={handleFileClick}
                  renderFileIcon={renderFileIcon}
                  renderFileMeta={renderFileMeta}
                  renderFolderBadge={renderFolderBadge}
                  selectedPath={selectedPath ?? undefined}
                  openPaths={openPaths}
                  onToggleFolder={onToggleFolder}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>

    <button
      type="button"
      className={cn("files-workspace-splitter", isResizing && "is-resizing")}
      data-testid="files-source-workspace-splitter"
      aria-label="패널 크기 조절"
      aria-orientation="vertical"
      title="패널 크기 조절"
      onMouseDown={onStartResize}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onNudgeResize("left");
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onNudgeResize("right");
        }
      }}
    />

    <Card className="files-workspace-panel">
      {!selectedPath ? (
        <div className="files-workspace-empty-preview">
          <header className="files-workspace-empty-preview__eyebrow">
            <span className="files-workspace-empty-preview__dot" aria-hidden="true" />
            <span>PREVIEW · SELECT TO INSPECT</span>
          </header>
          <div className="files-workspace-empty-preview__anchor" aria-hidden="true">
            <FileText />
          </div>
          <div className="files-workspace-empty-preview-copy">
            <strong className="files-workspace-empty-preview-title">파일을 선택하면 내용을 미리 볼 수 있습니다</strong>
            <div className="files-workspace-empty-preview-text">좌측 트리에서 소스를 클릭하면 문법 하이라이팅 · 연결된 Finding · 빌드 타겟 링크가 이 패널에 함께 로드됩니다.</div>
          </div>
          <ul className="files-workspace-empty-preview__hints">
            <li>
              <span className="files-workspace-empty-preview__hint-icon"><Code2 aria-hidden="true" /></span>
              <span className="files-workspace-empty-preview__hint-label">문법 하이라이트</span>
              <span className="files-workspace-empty-preview__hint-tag">syntax</span>
            </li>
            <li>
              <span className="files-workspace-empty-preview__hint-icon"><Shield aria-hidden="true" /></span>
              <span className="files-workspace-empty-preview__hint-label">연결된 Finding</span>
              <span className="files-workspace-empty-preview__hint-tag">severity</span>
            </li>
            <li>
              <span className="files-workspace-empty-preview__hint-icon"><Layers aria-hidden="true" /></span>
              <span className="files-workspace-empty-preview__hint-label">빌드 타겟 링크</span>
              <span className="files-workspace-empty-preview__hint-tag">compile_commands</span>
            </li>
          </ul>
        </div>
      ) : previewLoading ? (
        <div className="files-workspace-loading-preview">
          <Spinner label="로딩 중..." />
        </div>
      ) : (
        <>
          <CardHeader className="files-workspace-preview-head">
            <CardContent>
              <FileText size={14} />
              <CardTitle className="files-workspace-preview-title">{selectedPath}</CardTitle>
              {previewLang ? <Badge variant="outline" className="files-workspace-preview-lang">{previewLang}</Badge> : null}
            </CardContent>
          </CardHeader>

          <CardContent className="files-workspace-preview-body">
            <ScrollArea className="files-workspace-preview-scroll">
              {previewContent !== null ? (
                <HighlightedCode code={previewContent} language={previewLang} highlightLineNos={highlightLines} />
              ) : (
                <div className="files-workspace-error-preview"><span className="files-workspace-error-preview-text">파일 내용을 불러올 수 없습니다</span></div>
              )}
            </ScrollArea>

            {selectedFileFindings.length > 0 ? (
              <div className="files-workspace-findings">
                <div className="files-workspace-findings-title">탐지 항목 ({selectedFileFindings.length})</div>
                <div className="files-workspace-findings-list">
                  {selectedFileFindings.map((finding) => {
                    const { line } = parseLocation(finding.location);
                    return (
                      <button key={finding.id} type="button" className="files-workspace-finding-row" onClick={() => onSelectFinding(finding.id)}>
                        <span className="files-workspace-finding-title">{finding.title}</span>
                        {line ? <span className="files-workspace-finding-line">:{line}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </CardContent>
        </>
      )}
    </Card>
  </div>
);
