import React, { useState, useMemo, useCallback } from "react";
import type { Finding } from "@aegis/shared";
import type { SourceFileEntry } from "../../api/client";
import {
  FileText,
  Search,
  ChevronsUpDown,
  ChevronsDownUp,
  Upload,
  Play,
  Code,
} from "lucide-react";
import { fetchSourceFileContent, logError } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { PageHeader, Spinner, SeverityBadge, FileTreeNode } from "../ui";
import { buildTree, filterTree } from "../../utils/tree";
import type { TreeNode } from "../../utils/tree";
import { computeFindingOverlay, getFindingCount } from "../../utils/findingOverlay";
import type { DirFindingCount } from "../../utils/findingOverlay";
import { formatFileSize } from "../../utils/format";
import { parseLocation } from "../../utils/location";
import { highlightLines as hlLines } from "../../utils/highlight";
import { LANG_GROUPS, getLangColorByName } from "../../constants/languages";
import "./SourceTreeView.css";

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
    <div className="source-tree__code">
      {lines.map((html, i) => {
        const lineNo = i + 1;
        const isHL = highlightLineNos?.has(lineNo);
        return (
          <div
            key={lineNo}
            className={`source-tree__code-line${isHL ? " source-tree__code-line--highlight" : ""}`}
          >
            <span className="source-tree__line-no">{lineNo}</span>
            <span className="source-tree__line-content" dangerouslySetInnerHTML={{ __html: html }} />
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

  // Build tree
  const tree = useMemo(() => buildTree(sourceFiles, getSourcePath), [sourceFiles]);

  const displayTree = useMemo(() => {
    if (!search.trim()) return tree;
    return filterTree(tree, search.trim().toLowerCase()) ?? { name: "", path: "", children: [] };
  }, [tree, search]);

  // Finding overlay
  const overlay = useMemo(
    () => (findings ? computeFindingOverlay(findings) : new Map<string, DirFindingCount>()),
    [findings],
  );

  // File findings for preview
  const selectedFileFindings = useMemo(() => {
    if (!selectedPath || !findings) return [];
    return findings.filter((f) => {
      const { fileName } = parseLocation(f.location);
      return fileName === selectedPath;
    });
  }, [selectedPath, findings]);

  // Highlight lines
  const highlightLines = useMemo(() => {
    const lines = new Set<number>();
    for (const f of selectedFileFindings) {
      const { line } = parseLocation(f.location);
      if (line) lines.add(parseInt(line));
    }
    return lines;
  }, [selectedFileFindings]);

  // Language stats
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

  const totalSize = useMemo(
    () => sourceFiles.reduce((sum, f) => sum + (f.size || 0), 0),
    [sourceFiles],
  );

  // File click → load content
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

  // Render delegates for FileTreeNode
  const renderFileIcon = useCallback(
    (data: SourceFileEntry) => (
      <FileText
        size={16}
        style={{ color: getLangColorByName(data.language), flexShrink: 0 }}
      />
    ),
    [],
  );

  const renderFileMeta = useCallback(
    (data: SourceFileEntry) => (
      <>
        {data.language && (
          <span className="ftree-meta ftree-lang">{data.language}</span>
        )}
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
          {counts.critical > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--critical">
              {counts.critical}
            </span>
          )}
          {counts.high > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--high">
              {counts.high}
            </span>
          )}
          {counts.medium > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--medium">
              {counts.medium}
            </span>
          )}
          {counts.low > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--low">
              {counts.low}
            </span>
          )}
        </span>
      );
    },
    [overlay],
  );

  // Preview file name for header
  const previewFileName = selectedPath?.split("/").pop() ?? "";

  return (
    <div className="source-tree">
      <PageHeader
        title="소스코드 탐색기"
        icon={<Code size={20} />}
        subtitle={`${sourceFiles.length}개 파일 · ${formatFileSize(totalSize)}`}
      />

      {/* Language bar */}
      {langStats.length > 0 && (
        <div className="card">
          <div className="source-tree__langbar">
            {langStats.map((item) => (
              <div
                key={item.group}
                className="source-tree__langbar-seg"
                style={{
                  width: `${(item.count / sourceFiles.length) * 100}%`,
                  background: item.color,
                }}
                title={`${item.group}: ${item.count}`}
              />
            ))}
          </div>
          <div className="source-tree__langbar-legend">
            {langStats.map((item) => (
              <div key={item.group} className="source-tree__langbar-item">
                <span
                  className="source-tree__langbar-dot"
                  style={{ background: item.color }}
                />
                <span className="source-tree__langbar-label">{item.group}</span>
                <span className="source-tree__langbar-value">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2-panel layout */}
      <div className="source-tree__layout">
        {/* Tree panel */}
        <div className="card source-tree__tree-panel">
          <div className="source-tree__tree-header">
            <div className="source-tree__search-area">
              <Search size={14} className="source-tree__search-icon" />
              <input
                type="text"
                className="source-tree__search"
                placeholder="파일 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="source-tree__toolbar">
              <button
                className="source-tree__toolbar-btn"
                title="폴더 전부 열기"
                onClick={() => {
                  setTreeDefaultOpen(true);
                  setTreeKey((k) => k + 1);
                }}
              >
                <ChevronsUpDown size={16} />
              </button>
              <button
                className="source-tree__toolbar-btn"
                title="폴더 전부 접기"
                onClick={() => {
                  setTreeDefaultOpen(false);
                  setTreeKey((k) => k + 1);
                }}
              >
                <ChevronsDownUp size={16} />
              </button>
            </div>
          </div>
          <div className="source-tree__tree-body">
            {displayTree.children.length === 0 ? (
              <div className="ftree-no-results">검색 결과가 없습니다</div>
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
        </div>

        {/* Preview panel */}
        <div className="card source-tree__preview-panel">
          {!selectedPath ? (
            <div className="source-tree__preview-empty">
              <FileText size={32} />
              <span>파일을 선택하면 내용을 미리 볼 수 있습니다</span>
            </div>
          ) : previewLoading ? (
            <div className="source-tree__preview-loading">
              <Spinner label="로딩 중..." />
            </div>
          ) : (
            <>
              <div className="source-tree__preview-header">
                <FileText
                  size={14}
                  style={{ color: getLangColorByName(previewLang), flexShrink: 0 }}
                />
                <span className="source-tree__preview-filename">
                  {selectedPath}
                </span>
                <div className="source-tree__preview-meta">
                  {previewLang && <span>{previewLang}</span>}
                </div>
              </div>

              <div className="source-tree__preview-body">
                {previewContent !== null ? (
                  <HighlightedCode
                    code={previewContent}
                    language={previewLang}
                    highlightLineNos={highlightLines}
                  />
                ) : (
                  <div className="source-tree__preview-empty">
                    <span>파일 내용을 불러올 수 없습니다</span>
                  </div>
                )}
              </div>

              {/* Findings for this file */}
              {selectedFileFindings.length > 0 && (
                <div className="source-tree__file-findings">
                  <div className="source-tree__file-findings-title">
                    Finding ({selectedFileFindings.length})
                  </div>
                  {selectedFileFindings.map((f) => {
                    const { line } = parseLocation(f.location);
                    return (
                      <div
                        key={f.id}
                        className="source-tree__finding-row"
                        onClick={() => onSelectFinding?.(f.id)}
                      >
                        <SeverityBadge severity={f.severity} size="sm" />
                        <span className="source-tree__finding-title">
                          {f.title}
                        </span>
                        {line && (
                          <span className="source-tree__finding-loc">
                            :{line}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="source-tree__actions">
        <button className="btn btn-secondary" onClick={onReupload}>
          <Upload size={14} />
          소스코드 재업로드
        </button>
        <button className="btn" onClick={onAnalysisStart}>
          <Play size={14} />
          분석 실행
        </button>
      </div>
    </div>
  );
};
