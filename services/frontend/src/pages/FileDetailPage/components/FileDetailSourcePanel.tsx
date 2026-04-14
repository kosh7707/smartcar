import React from "react";
import type { Vulnerability } from "@aegis/shared";
import { FileText, Maximize2, Minimize2 } from "lucide-react";

interface FileDetailSourcePanelProps {
  fileName: string;
  fileLanguage?: string;
  sourceCode: string;
  sourceLines: string[];
  highlightedSourceLines: string[];
  fileVulns: Vulnerability[];
  highlightLine: number;
  highlightRef: React.RefObject<HTMLDivElement | null>;
  viewTab: "code" | "preview";
  onViewTabChange: (value: "code" | "preview") => void;
  maximized: boolean;
  onToggleMaximized: () => void;
  renderedPreview: React.ReactNode;
}

export const FileDetailSourcePanel: React.FC<FileDetailSourcePanelProps> = ({
  fileName,
  fileLanguage,
  sourceCode,
  sourceLines,
  highlightedSourceLines,
  fileVulns,
  highlightLine,
  highlightRef,
  viewTab,
  onViewTabChange,
  maximized,
  onToggleMaximized,
  renderedPreview,
}) => {
  const isMarkdown = fileName.endsWith(".md") || fileLanguage === "markdown" || fileLanguage === "md";

  const codeContent = (
    <div className={`code-viewer${maximized ? "" : " code-viewer--scrollable"}`}>
      {sourceLines.map((line, index) => {
        const lineNum = index + 1;
        const hasVulnerability = fileVulns.some((vulnerability) => {
          const match = vulnerability.location?.match(/:(\d+)/);
          return match && Number.parseInt(match[1], 10) === lineNum;
        });
        const isTarget = lineNum === highlightLine;
        return (
          <div
            key={`${lineNum}-${line}`}
            ref={isTarget ? highlightRef : undefined}
            className={`code-line ${hasVulnerability || isTarget ? "code-line-highlight" : ""}`}
          >
            <span className="code-line-num">{lineNum}</span>
            <span className="code-line-content" dangerouslySetInnerHTML={{ __html: highlightedSourceLines[index] ?? line }} />
            {(hasVulnerability || isTarget) && <span className="code-line-marker">← 취약점</span>}
          </div>
        );
      })}
    </div>
  );

  const viewBody = viewTab === "preview" && isMarkdown ? renderedPreview : codeContent;

  const toolbar = (
    <div className="file-detail-toolbar">
      {isMarkdown ? (
        <div className="file-detail-tabs">
          <button
            className={`file-detail-tab${viewTab === "code" ? " file-detail-tab--active" : ""}`}
            onClick={() => onViewTabChange("code")}
          >
            코드
          </button>
          <button
            className={`file-detail-tab${viewTab === "preview" ? " file-detail-tab--active" : ""}`}
            onClick={() => onViewTabChange("preview")}
          >
            프리뷰
          </button>
        </div>
      ) : (
        <div className="file-detail-toolbar__title">소스 코드</div>
      )}
      <button
        className="file-detail-maximize-btn"
        title={maximized ? "축소" : "전체 화면"}
        onClick={onToggleMaximized}
      >
        {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  );

  if (maximized) {
    return (
      <div className="file-detail-maximized-overlay" onClick={onToggleMaximized}>
        <div className="file-detail-maximized-panel card" onClick={(event) => event.stopPropagation()}>
          {toolbar}
          <div className="file-detail-maximized-body">{viewBody}</div>
        </div>
      </div>
    );
  }

  return (
    <section className="card file-detail-code-card">
      {toolbar}
      <div className="file-detail-code-body">{viewBody}</div>
      {!isMarkdown && sourceCode.length === 0 && (
        <div className="file-detail-code-empty">
          <FileText size={24} />
          <span>표시할 소스 코드가 없습니다</span>
        </div>
      )}
    </section>
  );
};
