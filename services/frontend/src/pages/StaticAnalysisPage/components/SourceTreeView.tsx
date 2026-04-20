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
import { cn } from "@/lib/utils";
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

const HighlightedCode: React.FC<{
  code: string;
  language?: string;
  highlightLineNos?: Set<number>;
}> = React.memo(({ code, language, highlightLineNos }) => {
  const lines = useMemo(() => hlLines(code, language), [code, language]);

  return (
    <div className="source-tree-code">
      {lines.map((html, index) => {
        const lineNo = index + 1;
        const isHighlighted = highlightLineNos?.has(lineNo);
        return (
          <div
            key={lineNo}
            className={cn(
              "source-tree-code-line",
              isHighlighted && "source-tree-code-line--highlighted",
            )}
          >
            <span className="source-tree-code-line-no">{lineNo}</span>
            <span
              className="source-tree-code-line-body"
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
    return findings.filter((finding) => parseLocation(finding.location).fileName === selectedPath);
  }, [selectedPath, findings]);

  const highlightLines = useMemo(() => {
    const lines = new Set<number>();
    for (const finding of selectedFileFindings) {
      const { line } = parseLocation(finding.location);
      if (line) lines.add(Number.parseInt(line, 10));
    }
    return lines;
  }, [selectedFileFindings]);

  const langStats = useMemo(() => {
    const grouped: Record<string, { count: number; color: string }> = {};
    for (const file of sourceFiles) {
      const lang = file.language || "기타";
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

  const totalSize = useMemo(
    () => sourceFiles.reduce((sum, file) => sum + (file.size || 0), 0),
    [sourceFiles],
  );

  const handleFileClick = useCallback(
    async (data: SourceFileEntry) => {
      setSelectedPath(data.relativePath);
      setPreviewContent(null);
      setPreviewLoading(true);
      setPreviewLang(data.language || "");
      try {
        const result = await fetchSourceFileContent(projectId, data.relativePath);
        setPreviewContent(result.content);
      } catch (error) {
        logError("Source file content", error);
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
        {data.language ? <span className="ftree-meta ftree-lang">{data.language}</span> : null}
        <span className="ftree-meta ftree-size">{formatFileSize(data.size)}</span>
      </>
    ),
    [],
  );

  const renderFolderBadge = useCallback(
    (node: TreeNode<SourceFileEntry>) => {
      const counts = getFindingCount(node.path, overlay);
      if (counts.total === 0) return null;
      return (
        <span className="ftree-folder-badge">
          {counts.critical > 0 ? (
            <span className="ftree-finding-dot ftree-finding-dot--critical">{counts.critical}</span>
          ) : null}
          {counts.high > 0 ? (
            <span className="ftree-finding-dot ftree-finding-dot--high">{counts.high}</span>
          ) : null}
          {counts.medium > 0 ? (
            <span className="ftree-finding-dot ftree-finding-dot--medium">{counts.medium}</span>
          ) : null}
          {counts.low > 0 ? (
            <span className="ftree-finding-dot ftree-finding-dot--low">{counts.low}</span>
          ) : null}
        </span>
      );
    },
    [overlay],
  );

  return (
    <div className="source-tree-shell">
      <PageHeader
        title="소스코드 탐색기"
        subtitle={`${sourceFiles.length}개 파일 · ${formatFileSize(totalSize)}`}
      />

      {langStats.length > 0 ? (
        <Card className="source-tree-summary-card">
          <CardContent className="source-tree-summary-body">
            <div className="source-tree-summary-bar">
              {langStats.map((item) => (
                <div
                  key={item.group}
                  className="source-tree-summary-segment"
                  style={{ width: `${(item.count / sourceFiles.length) * 100}%`, background: item.color }}
                  title={`${item.group}: ${item.count}`}
                />
              ))}
            </div>
            <div className="source-tree-summary-legend">
              {langStats.map((item) => (
                <div key={item.group} className="source-tree-summary-legend-item">
                  <span className="source-tree-summary-dot" style={{ background: item.color }} />
                  <span className="source-tree-summary-label">{item.group}</span>
                  <span className="source-tree-summary-count">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="source-tree-grid">
        <Card className="source-tree-panel">
          <CardContent className="source-tree-panel-body">
            <div className="source-tree-toolbar">
              <InputGroup className="source-tree-search-group">
                <InputGroupAddon>
                  <Search size={14} />
                </InputGroupAddon>
                <InputGroupInput
                  type="text"
                  placeholder="파일 검색..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </InputGroup>
              <div className="source-tree-toolbar-actions">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="폴더 전부 열기"
                  onClick={() => {
                    setTreeDefaultOpen(true);
                    setTreeKey((current) => current + 1);
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
                    setTreeKey((current) => current + 1);
                  }}
                >
                  <ChevronsDownUp size={16} />
                </Button>
              </div>
            </div>
            <ScrollArea className="source-tree-scroll">
              <div className="source-tree-list">
                {displayTree.children.length === 0 ? (
                  <div className="source-tree-empty">검색 결과가 없습니다</div>
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

        <Card className="source-tree-panel">
          {!selectedPath ? (
            <div className="source-tree-preview-empty">
              <FileText size={32} className="source-tree-preview-empty-icon" />
              <div className="source-tree-preview-empty-copy">
                <strong className="source-tree-preview-empty-title">
                  파일을 선택하면 내용을 미리 볼 수 있습니다
                </strong>
                <span>
                  좌측 트리에서 소스를 선택하면 코드 미리보기와 연결된 탐지 항목이 함께 표시됩니다.
                </span>
              </div>
            </div>
          ) : previewLoading ? (
            <div className="source-tree-preview-loading">
              <Spinner label="로딩 중..." />
            </div>
          ) : (
            <>
              <CardHeader className="source-tree-preview-head">
                <div className="source-tree-preview-head-row">
                  <FileText
                    size={14}
                    style={{ color: getLangColorByName(previewLang), flexShrink: 0 }}
                  />
                  <CardTitle className="source-tree-preview-title">{selectedPath}</CardTitle>
                  {previewLang ? <span className="source-tree-preview-lang">{previewLang}</span> : null}
                </div>
              </CardHeader>
              <CardContent className="source-tree-preview-body">
                <ScrollArea className="source-tree-preview-scroll">
                  {previewContent !== null ? (
                    <HighlightedCode
                      code={previewContent}
                      language={previewLang}
                      highlightLineNos={highlightLines}
                    />
                  ) : (
                    <div className="source-tree-preview-message">파일 내용을 불러올 수 없습니다</div>
                  )}
                </ScrollArea>

                {selectedFileFindings.length > 0 ? (
                  <div className="source-tree-findings">
                    <div className="source-tree-findings-title">
                      Finding ({selectedFileFindings.length})
                    </div>
                    <div className="source-tree-findings-list">
                      {selectedFileFindings.map((finding) => {
                        const { line } = parseLocation(finding.location);
                        return (
                          <button
                            key={finding.id}
                            type="button"
                            className="source-tree-finding-item"
                            onClick={() => onSelectFinding?.(finding.id)}
                          >
                            <SeverityBadge severity={finding.severity} size="sm" />
                            <span className="source-tree-finding-title">{finding.title}</span>
                            {line ? <span className="source-tree-finding-line">:{line}</span> : null}
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

      <div className="source-tree-actions">
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
