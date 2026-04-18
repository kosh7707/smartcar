import React from "react";
import { ChevronsDownUp, ChevronsUpDown, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
    className="grid min-h-[520px] items-stretch gap-4 max-[900px]:grid-cols-1 md:grid-cols-[minmax(280px,var(--files-tree-panel-width))_12px_minmax(360px,1fr)]"
    data-testid="files-source-workspace"
    style={{ ["--files-tree-panel-width" as string]: `${treePanelWidth}px` } as React.CSSProperties}
  >
    <Card className="min-h-0 border-border/80 bg-card/95 shadow-none max-[900px]:min-h-[320px]">
      <CardHeader className="border-b border-border/70 pb-3">
        <div className="flex items-center gap-3">
          <InputGroup className="h-10 flex-1 bg-background/80">
            <InputGroupAddon>
              <Search size={14} />
            </InputGroupAddon>
            <InputGroupInput
              type="text"
              placeholder="파일 검색..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </InputGroup>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title="폴더 전부 열기"
              onClick={onExpandAll}
            >
              <ChevronsUpDown size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="폴더 전부 접기"
              onClick={onCollapseAll}
            >
              <ChevronsDownUp size={16} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 px-0 pt-0">
        <ScrollArea className="min-h-0 flex-1">
          <div className="py-2">
            {displayTree.children.length === 0 ? (
              <div className="px-4 py-6 text-center text-base text-muted-foreground">검색 결과가 없습니다</div>
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
      className={cn(
        "relative hidden cursor-col-resize border-0 bg-transparent outline-none md:block",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded-full after:bg-border after:transition-[background,box-shadow]",
        "hover:after:bg-primary hover:after:shadow-[0_0_0_4px_rgba(15,98,254,0.08)] focus-visible:after:bg-primary focus-visible:after:shadow-[0_0_0_4px_rgba(15,98,254,0.08)]",
        isResizing && "after:bg-primary after:shadow-[0_0_0_4px_rgba(15,98,254,0.08)]",
      )}
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

    <Card className="min-h-0 border-border/80 bg-card/95 shadow-none max-[900px]:min-h-[320px]">
      {!selectedPath ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 py-10 text-center text-base text-muted-foreground">
          <FileText size={32} className="text-muted-foreground" />
          <div className="flex max-w-sm flex-col gap-2">
            <strong className="text-base font-semibold text-foreground">파일을 선택하면 내용을 미리 볼 수 있습니다</strong>
            <span>좌측 트리에서 소스를 선택하면 코드 미리보기와 연결된 탐지 항목이 함께 표시됩니다.</span>
          </div>
        </div>
      ) : previewLoading ? (
        <div className="flex h-full items-center justify-center px-8 py-10 text-base text-muted-foreground">
          <Spinner label="로딩 중..." />
        </div>
      ) : (
        <>
          <CardHeader className="border-b border-border/70 pb-3">
            <div className="flex items-center gap-3">
              <FileText size={14} className="shrink-0 text-muted-foreground" />
              <CardTitle className="min-w-0 flex-1 truncate font-mono text-sm font-medium">
                {selectedPath}
              </CardTitle>
              {previewLang && (
                <Badge variant="outline" className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {previewLang}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col px-0 pt-0">
            <ScrollArea className="min-h-0 flex-1">
              {previewContent !== null ? (
                <HighlightedCode
                  code={previewContent}
                  language={previewLang}
                  highlightLineNos={highlightLines}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-8 py-10 text-base text-muted-foreground">
                  <span>파일 내용을 불러올 수 없습니다</span>
                </div>
              )}
            </ScrollArea>

            {selectedFileFindings.length > 0 && (
              <div className="border-t border-border/70 bg-muted/20 px-5 py-4">
                <div className="mb-3 text-sm font-semibold text-muted-foreground">
                  탐지 항목 ({selectedFileFindings.length})
                </div>
                <div className="space-y-1">
                  {selectedFileFindings.map((finding) => {
                    const { line } = parseLocation(finding.location);
                    return (
                      <button
                        type="button"
                        key={finding.id}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-background hover:text-primary"
                        onClick={() => onSelectFinding(finding.id)}
                      >
                        <span className="min-w-0 flex-1 truncate">{finding.title}</span>
                        {line && <span className="shrink-0 font-mono text-xs text-muted-foreground">:{line}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </>
      )}
    </Card>
  </div>
);
