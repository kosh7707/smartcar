import React, { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import type { AnalysisResult, UploadedFile, Vulnerability } from "@aegis/shared";
import { FileText, Download, FileSearch, Shield, Maximize2, Minimize2, FileCode, Terminal, Wrench, Settings, BookOpen, Link2 } from "lucide-react";
import { fetchProjectOverview, fetchProjectFiles, fetchSourceFiles, fetchFileContent, fetchSourceFileContent, logError } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { VulnerabilityDetailView } from "../components/static/VulnerabilityDetailView";
import { BackButton, EmptyState, SeverityBadge, SeveritySummary, ListItem, Spinner } from "../components/ui";
import { formatFileSize, formatDateTime } from "../utils/format";
import { findFileByLocation } from "../utils/fileMatch";
import { parseLocation } from "../utils/location";
import { highlightLines } from "../utils/highlight";
import { getLangColorByName } from "../constants/languages";
import { renderMarkdown } from "../utils/markdown";
import "./FileDetailPage.css";

const FileDetailIcon: React.FC<{ language?: string }> = ({ language }) => {
  const size = 28;
  const lang = language?.toLowerCase() ?? "";
  const color = getLangColorByName(lang) || "var(--text-tertiary)";
  if (["c", "cpp", "cc", "cxx", "h", "hpp", "hh", "hxx", "java", "python", "py", "javascript", "js", "typescript", "ts"].includes(lang)) {
    return <FileCode size={size} style={{ color, flexShrink: 0 }} />;
  }
  if (["shell", "sh", "bash", "powershell"].includes(lang)) return <Terminal size={size} style={{ color, flexShrink: 0 }} />;
  if (["cmake", "make"].includes(lang)) return <Wrench size={size} style={{ color: "#064f8c", flexShrink: 0 }} />;
  if (["json", "yaml", "yml", "toml", "xml", "config"].includes(lang)) return <Settings size={size} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />;
  if (["markdown", "md", "text", "txt"].includes(lang)) return <BookOpen size={size} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />;
  if (["linker-script"].includes(lang)) return <Link2 size={size} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />;
  return <FileText size={size} style={{ color, flexShrink: 0 }} />;
};

export const FileDetailPage: React.FC = () => {
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightLine = parseInt(searchParams.get("line") ?? "0") || 0;
  const highlightRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<UploadedFile | null>(null);
  const [sourceCode, setSourceCode] = useState<string | null>(null);
  const [serverLineCount, setServerLineCount] = useState<number | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [viewTab, setViewTab] = useState<"code" | "preview">("code");
  const [maximized, setMaximized] = useState(false);
  const toast = useToast();

  // ESC to close maximized view
  useEffect(() => {
    if (!maximized) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMaximized(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [maximized]);

  const isSourceFile = fileId?.startsWith("source:") ?? false;
  const sourcePath = isSourceFile ? fileId!.slice("source:".length) : null;

  useEffect(() => {
    if (!projectId || !fileId) return;
    setLoading(true);

    const loadFileData = async () => {
      if (isSourceFile && sourcePath) {
        // Source file: use source API
        const [srcContent, overview] = await Promise.all([
          fetchSourceFileContent(projectId, sourcePath).catch(() => null),
          fetchProjectOverview(projectId),
        ]);
        const fileName = sourcePath.split("/").pop() || sourcePath;
        setFile({
          id: fileId,
          name: fileName,
          size: srcContent?.size ?? 0,
          language: srcContent?.language,
          path: sourcePath,
        });
        setServerLineCount(srcContent?.lineCount ?? null);
        setSourceCode(srcContent?.content ?? null);

        // Match analyses by path
        const filtered = overview.recentAnalyses
          .filter((a) => a.module === "static_analysis" || a.module === "deep_analysis")
          .filter((a) => a.vulnerabilities.some((v) => {
            if (!v.location) return false;
            const fname = parseLocation(v.location).fileName;
            return fname === sourcePath || fname === fileName
              || fname.split("/").pop() === fileName;
          }));
        setAnalyses(filtered);
      } else {
        // Legacy file: use file ID API
        const [files, overview, fileData] = await Promise.all([
          fetchProjectFiles(projectId),
          fetchProjectOverview(projectId),
          fetchFileContent(fileId!).catch(() => null),
        ]);
        const found = files.find((f) => f.id === fileId);
        setFile(found ?? null);
        setSourceCode(fileData?.content ?? null);

        if (found) {
          const filtered = overview.recentAnalyses
            .filter((a) => a.module === "static_analysis" || a.module === "deep_analysis")
            .filter((a) => {
              if (a.analyzedFileIds && a.analyzedFileIds.length > 0) {
                return a.analyzedFileIds.includes(fileId!);
              }
              return a.vulnerabilities.some((v) => {
                if (!v.location) return false;
                const fname = parseLocation(v.location).fileName;
                return fname === found.name || fname === found.path
                  || fname.split("/").pop() === found.name;
              });
            });
          setAnalyses(filtered);
        }
      }
    };

    loadFileData()
      .catch((e) => { logError("Load file detail", e); toast.error("파일 정보를 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
    // Only re-fetch when route params change; overview/toast are stable or loaded separately
  }, [projectId, fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to highlighted line
  useEffect(() => {
    if (highlightLine > 0 && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightLine, loading]);

  const sourceLines = sourceCode?.split("\n") ?? [];
  const highlightedSourceLines = useMemo(
    () => sourceCode ? highlightLines(sourceCode, file?.language ?? undefined) : [],
    [sourceCode, file?.language],
  );

  const fileVulns = useMemo(() => {
    if (!file) return [];
    const result: Vulnerability[] = [];
    for (const a of analyses) {
      for (const v of a.vulnerabilities) {
        if (!v.location) continue;
        const fname = parseLocation(v.location).fileName;
        if (fname === file.name || fname === file.path || fname.split("/").pop() === file.name) {
          result.push(v);
        }
      }
    }
    return result;
  }, [file, analyses]);

  const handleDownload = async () => {
    if (!file || !sourceCode) return;
    const blob = new Blob([sourceCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (selectedVuln) {
    return (
      <VulnerabilityDetailView
        vulnerability={selectedVuln}
        projectId={projectId ?? ""}
        onBack={() => setSelectedVuln(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="파일 정보 로딩 중..." />
      </div>
    );
  }

  if (!file) {
    return <h2 className="page-title">파일을 찾을 수 없습니다</h2>;
  }

  return (
    <div className="page-enter">
      <BackButton onClick={() => navigate(-1)} label="뒤로" />

      {/* File info header */}
      <div className="card file-detail-header">
        <div className="file-detail-header__top">
          <FileDetailIcon language={file.language} />
          <div className="file-detail-header__info">
            <h2 className="file-detail-header__name">{file.name}</h2>
            {file.path && file.path !== file.name && (
              <span className="file-detail-header__path">{file.path}</span>
            )}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleDownload}>
            <Download size={14} /> 다운로드
          </button>
        </div>
        <div className="file-detail-header__badges">
          {file.language && (
            <span className="file-detail-badge" style={{ borderColor: getLangColorByName(file.language) }}>
              <span className="file-detail-badge__dot" style={{ background: getLangColorByName(file.language) }} />
              {file.language}
            </span>
          )}
          {file.size > 0 && (
            <span className="file-detail-badge">
              {formatFileSize(file.size)}
            </span>
          )}
          <span className="file-detail-badge">
            {serverLineCount ?? sourceLines.length}줄
          </span>
          {fileVulns.length > 0 && (
            <span className="file-detail-badge file-detail-badge--warn">
              <Shield size={12} />
              취약점 {fileVulns.length}건
            </span>
          )}
        </div>
      </div>

      {/* Source code / Preview */}
      {sourceCode !== null && (() => {
        const isMarkdown = file.name.endsWith(".md") || file.language === "markdown" || file.language === "md";

        const codeContent = (
          <div className={`code-viewer${maximized ? "" : " code-viewer--scrollable"}`}>
            {sourceLines.map((line, i) => {
              const lineNum = i + 1;
              const hasVuln = fileVulns.some((v) => {
                const match = v.location?.match(/:(\d+)/);
                return match && parseInt(match[1]) === lineNum;
              });
              const isTarget = lineNum === highlightLine;
              return (
                <div
                  key={i}
                  ref={isTarget ? highlightRef : undefined}
                  className={`code-line ${hasVuln || isTarget ? "code-line-highlight" : ""}`}
                >
                  <span className="code-line-num">{lineNum}</span>
                  <span className="code-line-content" dangerouslySetInnerHTML={{ __html: highlightedSourceLines[i] ?? line }} />
                  {(hasVuln || isTarget) && <span className="code-line-marker">← 취약점</span>}
                </div>
              );
            })}
          </div>
        );

        const previewContent = isMarkdown ? (
          <div className={`file-detail-md-preview${maximized ? " file-detail-md-preview--maximized" : ""}`}>
            {renderMarkdown(sourceCode)}
          </div>
        ) : null;

        const toolbar = (
          <div className="file-detail-toolbar">
            {isMarkdown && (
              <div className="file-detail-tabs">
                <button
                  className={`file-detail-tab${viewTab === "code" ? " file-detail-tab--active" : ""}`}
                  onClick={() => setViewTab("code")}
                >
                  코드
                </button>
                <button
                  className={`file-detail-tab${viewTab === "preview" ? " file-detail-tab--active" : ""}`}
                  onClick={() => setViewTab("preview")}
                >
                  프리뷰
                </button>
              </div>
            )}
            {!isMarkdown && <div className="card-title" style={{ margin: 0 }}>소스 코드</div>}
            <button
              className="file-detail-maximize-btn"
              title={maximized ? "축소" : "전체 화면"}
              onClick={() => setMaximized(!maximized)}
            >
              {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        );

        const viewBody = viewTab === "preview" && isMarkdown ? previewContent : codeContent;

        if (maximized) {
          return (
            <div className="file-detail-maximized-overlay" onClick={() => setMaximized(false)}>
              <div className="file-detail-maximized-panel card" onClick={(e) => e.stopPropagation()}>
                {toolbar}
                <div className="file-detail-maximized-body">
                  {viewBody}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="card">
            {toolbar}
            {viewBody}
          </div>
        );
      })()}

      {/* Vulnerabilities */}
      <div className="card">
        <div className="card-title">
          <Shield size={16} />
          발견된 취약점 ({fileVulns.length})
        </div>
        {fileVulns.length === 0 ? (
          <EmptyState
            icon={<Shield size={28} />}
            title="이 파일에서 발견된 취약점이 없습니다"
          />
        ) : (
          <div>
            {fileVulns.map((v) => (
              <ListItem
                key={v.id}
                onClick={() => setSelectedVuln(v)}
                trailing={<span className="file-detail-vuln-source">{v.source === "rule" ? "룰" : "LLM"}</span>}
              >
                <div className="file-detail-vuln-row">
                  <SeverityBadge severity={v.severity} size="sm" />
                  <span className="file-detail-vuln-title">{v.title}</span>
                  <span className="file-detail-vuln-location">{v.location}</span>
                </div>
              </ListItem>
            ))}
          </div>
        )}
      </div>

      {/* Related analysis history */}
      <div className="card">
        <div className="card-title">
          <FileSearch size={16} />
          관련 분석 이력 ({analyses.length})
        </div>
        {analyses.length === 0 ? (
          <p className="text-tertiary">이 파일이 포함된 분석 이력이 없습니다.</p>
        ) : (
          <div>
            {analyses.map((a) => (
              <ListItem
                key={a.id}
                onClick={() => navigate(`/projects/${projectId}/static-analysis?analysisId=${a.id}`)}
                trailing={<span className="text-sm text-tertiary">{formatDateTime(a.createdAt)}</span>}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span className="font-medium">취약점 {a.summary.total}건</span>
                  <SeveritySummary summary={a.summary} />
                </div>
              </ListItem>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
