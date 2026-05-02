import "./FileDetailSourcePanel.css";
import React from "react";
import type { Vulnerability } from "@aegis/shared";
import { FileText, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/common/utils/cn";
import { Modal } from "@/common/ui/primitives/Modal";

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
  const isMarkdown =
    fileName.endsWith(".md") ||
    fileLanguage === "markdown" ||
    fileLanguage === "md";

  const codeContent = (
    <div className={"scroll-area" + " " + cn(
        "file-detail-source-code-scroll",
        maximized && "is-maximized",
      )}
    >
      <div className="file-detail-source-code">
        {sourceLines.map((line, index) => {
          const lineNum = index + 1;
          const hasVulnerability = fileVulns.some((vulnerability) => {
            const match = vulnerability.location?.match(/:(\d+)/);
            return match && Number.parseInt(match[1], 10) === lineNum;
          });
          const isTarget = lineNum === highlightLine;
          const isHighlighted = hasVulnerability || isTarget;

          return (
            <div
              key={`${lineNum}-${line}`}
              ref={isTarget ? highlightRef : undefined}
              className={cn(
                "file-detail-source-line",
                isHighlighted
                  ? "file-detail-source-line--highlighted"
                  : "file-detail-source-line--hoverable",
              )}
            >
              <span className="file-detail-source-line-num">{lineNum}</span>
              <span
                className="file-detail-source-line-text"
                dangerouslySetInnerHTML={{
                  __html: highlightedSourceLines[index] ?? line,
                }}
              />
              {isHighlighted ? (
                <span className="file-detail-source-line-flag">← 취약점</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  const previewContent = (
    <div className={"scroll-area" + " " + cn(
        "file-detail-source-preview-scroll",
        maximized && "is-maximized",
      )}
    >
      <div className="file-detail-markdown file-detail-source-preview-body">
        {renderedPreview}
      </div>
    </div>
  );

  const maximizeButton = (
    <button type="button"
      title={maximized ? "축소" : "전체 화면"}
      aria-label={maximized ? "축소" : "전체 화면"}
      onClick={onToggleMaximized}
      className="btn btn-ghost btn-icon-sm file-detail-source-maximize"
    >
      {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  );

  const nonMarkdownBody = (
    <>
      <div className="file-detail-source-panel-head">
        <div className="file-detail-source-panel-title">소스 코드</div>
        {maximizeButton}
      </div>
      <div className="file-detail-source-panel-body">
        {codeContent}
        {sourceCode.length === 0 ? (
          <div className="file-detail-source-empty">
            <FileText size={20} />
            <span>표시할 소스 코드가 없습니다</span>
          </div>
        ) : null}
      </div>
    </>
  );

  const markdownBody = (
    <div
      value={viewTab}
      onValueChange={(value) => onViewTabChange(value as "code" | "preview")}
      className="file-detail-source-tabs"
    >
      <div className="file-detail-source-panel-head">
        <div className="seg file-detail-source-tabs-list" role="tablist">
          <button type="button" role="tab" value="code" className="file-detail-source-tabs-trigger">
            코드
          </button>
          <button type="button" role="tab" value="preview" className="file-detail-source-tabs-trigger">
            프리뷰
          </button>
        </div>
        {maximizeButton}
      </div>
      <div className="file-detail-source-panel-body">
        <div role="tabpanel" value="code" className="file-detail-source-tabs-content">
          {codeContent}
        </div>
        <div role="tabpanel" value="preview" className="file-detail-source-tabs-content">
          {previewContent}
        </div>
      </div>
    </div>
  );

  const panelBody = isMarkdown ? markdownBody : nonMarkdownBody;

  if (maximized) {
    return (
      <Modal
        open={maximized}
        onClose={onToggleMaximized}
        className="file-detail-source-dialog"
        overlayClassName="file-detail-source-overlay"
      >
          <header className="sr-only">
            <h2>{fileName} 전체 화면 보기</h2>
            <p>
              파일 소스 코드와 마크다운 프리뷰를 전체 화면으로 확인합니다.
            </p>
          </header>
          <div className="file-detail-source-dialog-shell">
            <div className="panel file-detail-source-dialog-card">
              <div className="panel-body file-detail-source-dialog-card-body">
                <div className="file-detail-source-dialog-content">{panelBody}</div>
              </div>
            </div>
          </div>
        </Modal>
    );
  }

  return (
    <div className="panel file-detail-source-card">
      <div className="panel-body file-detail-source-card-body">{panelBody}</div>
    </div>
  );
};
