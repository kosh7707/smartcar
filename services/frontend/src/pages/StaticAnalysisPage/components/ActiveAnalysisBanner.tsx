import React from "react";
import type { AnalysisProgress } from "@aegis/shared";
import { Eye, XCircle } from "lucide-react";

interface Props {
  progress: AnalysisProgress;
  onView: () => void;
  onAbort: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  queued: "대기 중",
  quick_sast: "빠른 분석 (SAST)",
  quick_graphing: "빠른 분석 (GraphRAG 적재)",
  quick_complete: "빠른 분석 완료",
  deep_submitting: "심층 분석 제출 중",
  deep_analyzing: "심층 분석 진행 중",
  deep_retrying: "심층 분석 재시도 중",
  deep_complete: "심층 분석 완료",
};

export const ActiveAnalysisBanner: React.FC<Props> = ({ progress, onView, onAbort }) => {
  const phaseText = PHASE_LABELS[progress.phase] ?? progress.phase;
  const llmDone =
    progress.phase === "deep_analyzing" &&
    progress.totalChunks > 0 &&
    progress.currentChunk >= progress.totalChunks;
  const chunkText =
    progress.phase === "deep_analyzing" && progress.totalChunks > 0
      ? llmDone
        ? " (완료)"
        : ` (${progress.currentChunk}/${progress.totalChunks} 단계)`
      : "";

  const pct =
    progress.phase === "queued"
      ? 5
      : progress.phase === "quick_sast"
        ? 25
        : progress.phase === "quick_graphing"
          ? 45
          : progress.phase === "quick_complete"
            ? 55
            : progress.phase === "deep_submitting"
              ? 65
              : progress.phase === "deep_retrying"
                ? 70
                : progress.phase === "deep_analyzing"
                  ? 70 + (progress.totalChunks > 0 ? (progress.currentChunk / progress.totalChunks) * 20 : 10)
                  : 100;

  return (
    <div className="panel active-analysis-banner" role="status" aria-live="polite">
      <div className="active-analysis-banner__body">
        <div className="active-analysis-banner__head">
          <span className="gate running">RUNNING</span>
          <span className="active-analysis-banner__copy">
            {progress.totalFiles
              ? `${progress.processedFiles ?? 0}/${progress.totalFiles}개 파일 분석 중 · `
              : ""}
            {phaseText}
            {chunkText}
          </span>
          {progress.buildTargetId || progress.executionId ? (
            <span className="active-analysis-banner__meta">
              {progress.buildTargetId ? (
                <>
                  <span className="sub-caps">BUILD TARGET</span>
                  <b className="mono-code">{progress.buildTargetId}</b>
                </>
              ) : null}
              {progress.buildTargetId && progress.executionId ? (
                <span className="sep" aria-hidden="true">
                  ·
                </span>
              ) : null}
              {progress.executionId ? (
                <>
                  <span className="sub-caps">EXECUTION</span>
                  <b className="mono-code">{progress.executionId}</b>
                </>
              ) : null}
            </span>
          ) : null}
          <div className="active-analysis-banner__actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={onView}>
              <Eye size={14} />
              보기
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={onAbort}>
              <XCircle size={14} />
              중단
            </button>
          </div>
        </div>
        <div className="att-progress" role="presentation">
          <div className="active-analysis-banner__progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
};
