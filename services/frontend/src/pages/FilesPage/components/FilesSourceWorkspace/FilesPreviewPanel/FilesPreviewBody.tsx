import React from "react";
import type { Finding, Severity } from "@aegis/shared";
import type { SourceFileEntry, TargetMappingEntry } from "../../../../../api/client";
import type { useBuildTargets } from "../../../../../hooks/useBuildTargets";
import { Spinner } from "../../../../../shared/ui";
import type { FileClass } from "../../../../../utils/fileClass";
import { parseLocation } from "../../../../../utils/location";
import { HighlightedCode } from "./HighlightedCode";
import { FilesBinaryPreview } from "./FilesBinaryPreview";
import { FilesManifestInsights } from "./FilesManifestInsights";

type PreviewPanelMode = "preview" | "insights";

interface FilesPreviewBodyProps {
  mode: PreviewPanelMode;
  selectedPath: string | null;
  previewLoading: boolean;
  previewLang: string;
  previewContent: string | null;
  previewFileClass: FileClass;
  previewSize: number;
  highlightLines: Set<number>;
  selectedFileFindings: Finding[];
  onSelectFinding: (findingId: string) => void;
  sourceFiles: SourceFileEntry[];
  targetMapping: Record<string, TargetMappingEntry>;
  targets: ReturnType<typeof useBuildTargets>["targets"];
  findingsByFile: Map<string, { total: number; topSeverity: Severity }>;
  composition: Record<string, { count: number; bytes: number }>;
  onInsightHotspotClick: (path: string) => void;
}

export const FilesPreviewBody: React.FC<FilesPreviewBodyProps> = ({
  mode,
  selectedPath,
  previewLoading,
  previewLang,
  previewContent,
  previewFileClass,
  previewSize,
  highlightLines,
  selectedFileFindings,
  onSelectFinding,
  sourceFiles,
  targetMapping,
  targets,
  findingsByFile,
  composition,
  onInsightHotspotClick,
}) => {
  if (mode === "preview" && selectedPath) {
    if (previewLoading) {
      return (
        <div className="files-workspace-loading-preview">
          <Spinner label="로딩 중..." />
        </div>
      );
    }
    return (
      <div className="panel-body files-workspace-preview-body">
        {previewFileClass !== "text" ? (
          <FilesBinaryPreview
            path={selectedPath}
            size={previewSize}
            language={previewLang || null}
            fileClass={previewFileClass}
          />
        ) : (
          <div className="scroll-area files-workspace-preview-scroll">
            {previewContent !== null ? (
              <HighlightedCode
                code={previewContent}
                language={previewLang}
                highlightLineNos={highlightLines}
              />
            ) : (
              <div className="files-workspace-error-preview">
                <span className="files-workspace-error-preview-text">
                  파일 내용을 불러올 수 없습니다
                </span>
              </div>
            )}
          </div>
        )}

        {selectedFileFindings.length > 0 ? (
          <div className="files-workspace-findings">
            <div className="files-workspace-findings-title">
              탐지 항목 ({selectedFileFindings.length})
            </div>
            <div className="files-workspace-findings-list">
              {selectedFileFindings.map((finding) => {
                const { line } = parseLocation(finding.location);
                return (
                  <button
                    key={finding.id}
                    type="button"
                    className="files-workspace-finding-row"
                    onClick={() => onSelectFinding(finding.id)}
                  >
                    <span className="files-workspace-finding-title">{finding.title}</span>
                    {line ? (
                      <span className="files-workspace-finding-line">:{line}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="panel-body files-workspace-panel-body files-workspace-insights-pane">
      <FilesManifestInsights
        sourceFiles={sourceFiles}
        targetMapping={targetMapping}
        targets={targets}
        findingsByFile={findingsByFile}
        composition={composition}
        onSelectFile={onInsightHotspotClick}
      />
    </div>
  );
};
