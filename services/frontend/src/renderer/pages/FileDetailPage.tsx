import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import type { AnalysisResult, UploadedFile, Vulnerability } from "@smartcar/shared";
import { FileText, Download, FileSearch, Shield } from "lucide-react";
import { fetchProjectOverview, fetchProjectFiles, fetchFileContent, logError } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { VulnerabilityDetailView } from "../components/static/VulnerabilityDetailView";
import { BackButton, EmptyState, SeverityBadge, SeveritySummary, ListItem, Spinner } from "../components/ui";
import { formatFileSize, formatDateTime } from "../utils/format";
import { findFileByLocation } from "../utils/fileMatch";
import "./FileDetailPage.css";

export const FileDetailPage: React.FC = () => {
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightLine = parseInt(searchParams.get("line") ?? "0") || 0;
  const highlightRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<UploadedFile | null>(null);
  const [sourceCode, setSourceCode] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!projectId || !fileId) return;
    setLoading(true);

    Promise.all([
      fetchProjectFiles(projectId),
      fetchProjectOverview(projectId),
      fetchFileContent(fileId).catch(() => null),
    ])
      .then(([files, overview, fileData]) => {
        const found = files.find((f) => f.id === fileId);
        setFile(found ?? null);
        setSourceCode(fileData?.content ?? null);

        if (found) {
          const filtered = overview.recentAnalyses
            .filter((a) => a.module === "static_analysis")
            .filter((a) => {
              // 1) analyzedFileIds가 있으면 그걸로 판단 (S2가 채워주는 필드)
              if (a.analyzedFileIds && a.analyzedFileIds.length > 0) {
                return a.analyzedFileIds.includes(fileId!);
              }
              // 2) 폴백: 취약점 location에 이 파일이 있는지 확인
              return a.vulnerabilities.some((v) => {
                if (!v.location) return false;
                const fname = v.location.split(":")[0];
                return fname === found.name || fname === found.path
                  || fname.split("/").pop() === found.name;
              });
            });
          setAnalyses(filtered);
        }
      })
      .catch((e) => { logError("Load file detail", e); toast.error("파일 정보를 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
  }, [projectId, fileId]);

  // Auto-scroll to highlighted line
  useEffect(() => {
    if (highlightLine > 0 && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightLine, loading]);

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
        projectId={projectId!}
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

  const fileVulns: Vulnerability[] = [];
  for (const a of analyses) {
    for (const v of a.vulnerabilities) {
      if (!v.location) continue;
      const fname = v.location.split(":")[0];
      if (fname === file.name || fname === file.path || fname.split("/").pop() === file.name) {
        fileVulns.push(v);
      }
    }
  }

  const sourceLines = sourceCode?.split("\n") ?? [];

  return (
    <div className="page-enter">
      <BackButton onClick={() => navigate(-1)} label="뒤로" />

      {/* File info header */}
      <div className="file-detail-header">
        <FileText size={24} className="file-detail-header__icon" />
        <div className="file-detail-header__info">
          <h2 className="page-title card-title--flush">{file.name}</h2>
          <div className="file-detail-header__meta">
            {file.language && <span>{file.language}</span>}
            <span>{formatFileSize(file.size)}</span>
            <span>{sourceLines.length}줄</span>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleDownload}>
          <Download size={14} /> 다운로드
        </button>
      </div>

      {/* Source code */}
      {sourceCode !== null && (
        <div className="card">
          <div className="card-title">소스 코드</div>
          <div className="code-viewer code-viewer--scrollable">
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
                  <span className="code-line-content">{line}</span>
                  {(hasVuln || isTarget) && <span className="code-line-marker">← 취약점</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
