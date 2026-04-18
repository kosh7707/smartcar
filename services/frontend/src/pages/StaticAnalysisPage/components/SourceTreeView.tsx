import React, { useState, useMemo, useCallback } from "react";
import type { Finding } from "@aegis/shared";
import type { SourceFileEntry } from "../../../api/client";
import {
  FileText,
  Search,
  ChevronsUpDown,
  ChevronsDownUp,
  Upload,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchSourceFileContent, logError } from "../../../api/client";
import { useToast } from "../../../contexts/ToastContext";
import { PageHeader, Spinner, SeverityBadge, FileTreeNode } from "../../../shared/ui";
import { buildTree, filterTree } from "../../../utils/tree";
import type { TreeNode } from "../../../utils/tree";
import { computeFindingOverlay, getFindingCount } from "../../../utils/findingOverlay";
import type { DirFindingCount } from "../../../utils/findingOverlay";
import { formatFileSize } from "../../../utils/format";
import { parseLocation } from "../../../utils/location";
import { highlightLines as hlLines } from "../../../utils/highlight";
import { LANG_GROUPS, getLangColorByName } from "../../../constants/languages";

interface Props {
  projectId: string;
  sourceFiles: SourceFileEntry[];
  findings?: Finding[];
  onAnalysisStart: () => void;
  onReupload: () => void;
  onSelectFinding?: (findingId: string) => void;
}

const getSourcePath = (f: SourceFileEntry) => f.relativePath;

const highlightedRowStyle = {
  background: "color-mix(in srgb, var(--aegis-severity-high) 10%, transparent)",
} as const;

const HighlightedCode: React.FC<{
  code: string;
  language?: string;
  highlightLineNos?: Set<number>;
}> = React.memo(({ code, language, highlightLineNos }) => {
  const lines = useMemo(() => hlLines(code, language), [code, language]);
  return (
    <div className="min-w-max font-mono text-sm leading-6">
      {lines.map((html, i) => {
        const lineNo = i + 1;
        const isHL = highlightLineNos?.has(lineNo);
        return (
          <div
            key={lineNo}
            className={`flex min-h-[22px] px-5 py-px${isHL ? "" : " hover:bg-muted/40"}`}
            style={isHL ? highlightedRowStyle : undefined}
          >
            <span className="inline-block min-w-10 shrink-0 pr-4 text-right text-muted-foreground select-none">
              {lineNo}
            </span>
            <span
              className="flex-1 whitespace-pre"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        );
      })}
    </div>
  );
});

export const SourceTreeView: React.FC<Props> = ({
  projectId,
  sourceFiles,
  findings,
  onAnalysisStart,
  onReupload,
  onSelectFinding,
}) => {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [treeKey, setTreeKey] = useState(0);
  const [treeDefaultOpen, setTreeDefaultOpen] = useState<boolean | undefined>(undefined);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLang, setPreviewLang] = useState("");

  const tree = useMemo(() => buildTree(sourceFiles, getSourcePath), [sourceFiles]);

  const displayTree = useMemo(() => {
    if (!search.trim()) return tree;
    return filterTree(tree, search.trim().toLowerCase()) ?? { name: "", path: "", children: [] };
  }, [tree, search]);

  const overlay = useMemo(
    () => (findings ? computeFindingOverlay(findings) : new Map<string, DirFindingCount>()),
    [findings],
  );

  const selectedFileFindings = useMemo(() => {
    if (!selectedPath || !findings) return [];
    return findings.filter((f) => parseLocation(f.location).fileName === selectedPath);
  }, [selectedPath, findings]);

  const highlightLines = useMemo(() => {
    const lines = new Set<number>();
    for (const f of selectedFileFindings) {
      const { line } = parseLocation(f.location);
      if (line) lines.add(parseInt(line));
    }
    return lines;
  }, [selectedFileFindings]);

  const langStats = useMemo(() => {
    const grouped: Record<string, { count: number; color: string }> = {};
    for (const f of sourceFiles) {
      const lang = f.language || "기타";
      const info = LANG_GROUPS[lang];
      const group = info?.group ?? "기타";
      const color = info?.color ?? "var(--cds-text-placeholder)";
      if (!grouped[group]) grouped[group] = { count: 0, color };
      grouped[group].count += 1;
    }
    return Object.entries(grouped)
      .map(([group, { count, color }]) => ({ group, count, color }))
      .sort((a, b) => b.count - a.count);
  }, [sourceFiles]);

  const totalSize = useMemo(() => sourceFiles.reduce((sum, f) => sum + (f.size || 0), 0), [sourceFiles]);

  const handleFileClick = useCallback(
    async (data: SourceFileEntry) => {
      setSelectedPath(data.relativePath);
      setPreviewContent(null);
      setPreviewLoading(true);
      setPreviewLang(data.language || "");
      try {
        const result = await fetchSourceFileContent(projectId, data.relativePath);
        setPreviewContent(result.content);
      } catch (e) {
        logError("Source file content", e);
        toast.error("파일 내용을 불러올 수 없습니다.");
        setPreviewContent(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [projectId, toast],
  );

  const renderFileIcon = useCallback(
    (data: SourceFileEntry) => (
      <FileText size={16} style={{ color: getLangColorByName(data.language), flexShrink: 0 }} />
    ),
    [],
  );

  const renderFileMeta = useCallback(
    (data: SourceFileEntry) => (
      <>
        {data.language && (
          <span className="ftree-meta ftree-lang inline-flex min-h-6 shrink-0 items-center rounded-full border border-border bg-background/90 px-2 font-mono text-sm tracking-wide text-muted-foreground">
            {data.language}
          </span>
        )}
        <span className="ftree-meta ftree-size min-w-12 shrink-0 text-right font-mono text-sm text-muted-foreground">
          {formatFileSize(data.size)}
        </span>
      </>
    ),
    [],
  );

  const renderFolderBadge = useCallback(
    (node: TreeNode<SourceFileEntry>) => {
      const counts = getFindingCount(node.path, overlay);
      if (counts.total === 0) return null;
      return (
        <span className="ftree-folder-badge flex shrink-0 items-center gap-1">
          {counts.critical > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--critical inline-flex h-5 items-center rounded-full bg-[color-mix(in_srgb,var(--aegis-severity-critical)_15%,transparent)] px-1.5 text-sm font-semibold text-[var(--aegis-severity-critical)]">
              {counts.critical}
            </span>
          )}
          {counts.high > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--high inline-flex h-5 items-center rounded-full bg-[color-mix(in_srgb,var(--aegis-severity-high)_15%,transparent)] px-1.5 text-sm font-semibold text-[var(--aegis-severity-high)]">
              {counts.high}
            </span>
          )}
          {counts.medium > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--medium inline-flex h-5 items-center rounded-full bg-[color-mix(in_srgb,var(--aegis-severity-medium)_15%,transparent)] px-1.5 text-sm font-semibold text-[var(--aegis-severity-medium)]">
              {counts.medium}
            </span>
          )}
          {counts.low > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--low inline-flex h-5 items-center rounded-full bg-[color-mix(in_srgb,var(--aegis-severity-low)_15%,transparent)] px-1.5 text-sm font-semibold text-[var(--aegis-severity-low)]">
              {counts.low}
            </span>
          )}
        </span>
      );
    },
    [overlay],
  );

  return (
    <div className="space-y-5">
      <PageHeader title="소스코드 탐색기" subtitle={`${sourceFiles.length}개 파일 · ${formatFileSize(totalSize)}`} />

      {langStats.length > 0 && (
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <div className="flex h-2 overflow-hidden rounded-full bg-border/70">
              {langStats.map((item) => (
                <div
                  key={item.group}
                  className="min-w-[2px] transition-[width]"
                  style={{ width: `${(item.count / sourceFiles.length) * 100}%`, background: item.color }}
                  title={`${item.group}: ${item.count}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-5">
              {langStats.map((item) => (
                <div key={item.group} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm text-muted-foreground">{item.group}</span>
                  <span className="text-sm font-semibold text-foreground">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid min-h-[400px] gap-5 max-[900px]:grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="flex min-h-0 flex-col overflow-hidden shadow-none">
          <CardContent className="flex min-h-0 flex-1 flex-col px-0 pt-0">
            <div className="flex items-center gap-3 border-b border-border/70 px-5 py-3">
              <InputGroup className="h-10 flex-1 bg-background/80">
                <InputGroupAddon>
                  <Search size={14} />
                </InputGroupAddon>
                <InputGroupInput
                  type="text"
                  placeholder="파일 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="폴더 전부 열기"
                  onClick={() => {
                    setTreeDefaultOpen(true);
                    setTreeKey((k) => k + 1);
                  }}
                >
                  <ChevronsUpDown size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="폴더 전부 접기"
                  onClick={() => {
                    setTreeDefaultOpen(false);
                    setTreeKey((k) => k + 1);
                  }}
                >
                  <ChevronsDownUp size={16} />
                </Button>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="py-2">
                {displayTree.children.length === 0 ? (
                  <div className="py-6 text-center text-base text-muted-foreground">검색 결과가 없습니다</div>
                ) : (
                  displayTree.children.map((node) => (
                    <FileTreeNode<SourceFileEntry>
                      key={`${treeKey}-${node.path}`}
                      node={node}
                      depth={0}
                      searchOpen={search.trim().length > 0}
                      defaultOpen={treeDefaultOpen}
                      onClickFile={handleFileClick}
                      renderFileIcon={renderFileIcon}
                      renderFileMeta={renderFileMeta}
                      renderFolderBadge={renderFolderBadge}
                      selectedPath={selectedPath ?? undefined}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden shadow-none">
          {!selectedPath ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-8 py-10 text-center text-base text-muted-foreground">
              <FileText size={32} className="text-muted-foreground" />
              <div className="max-w-sm space-y-2">
                <strong className="block text-base font-semibold text-foreground">파일을 선택하면 내용을 미리 볼 수 있습니다</strong>
                <span>좌측 트리에서 소스를 선택하면 코드 미리보기와 연결된 탐지 항목이 함께 표시됩니다.</span>
              </div>
            </div>
          ) : previewLoading ? (
            <div className="flex h-full items-center justify-center px-8 py-10">
              <Spinner label="로딩 중..." />
            </div>
          ) : (
            <>
              <CardHeader className="border-b border-border/70 pb-4">
                <div className="flex items-center gap-3">
                  <FileText size={14} style={{ color: getLangColorByName(previewLang), flexShrink: 0 }} />
                  <CardTitle className="min-w-0 flex-1 truncate font-mono text-sm font-medium">
                    {selectedPath}
                  </CardTitle>
                  {previewLang && (
                    <span className="rounded-full border border-border bg-background/90 px-2 py-0.5 text-sm text-muted-foreground">
                      {previewLang}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col px-0 pt-0">
                <ScrollArea className="min-h-0 flex-1">
                  {previewContent !== null ? (
                    <HighlightedCode code={previewContent} language={previewLang} highlightLineNos={highlightLines} />
                  ) : (
                    <div className="flex h-full items-center justify-center px-8 py-10 text-base text-muted-foreground">
                      <span>파일 내용을 불러올 수 없습니다</span>
                    </div>
                  )}
                </ScrollArea>

                {selectedFileFindings.length > 0 && (
                  <div className="border-t border-border/70 px-5 py-4">
                    <div className="mb-3 text-sm font-semibold text-muted-foreground">Finding ({selectedFileFindings.length})</div>
                    <div className="space-y-1">
                      {selectedFileFindings.map((f) => {
                        const { line } = parseLocation(f.location);
                        return (
                          <button
                            key={f.id}
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted/30"
                            onClick={() => onSelectFinding?.(f.id)}
                          >
                            <SeverityBadge severity={f.severity} size="sm" />
                            <span className="min-w-0 flex-1 truncate">{f.title}</span>
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

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onReupload}>
          <Upload size={14} />
          소스코드 재업로드
        </Button>
        <Button onClick={onAnalysisStart}>
          <Play size={14} />
          분석 실행
        </Button>
      </div>
    </div>
  );
};
