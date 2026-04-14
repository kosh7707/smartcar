import React from "react";
import type { AnalysisProgress } from "@aegis/shared";
import { Loader2, Eye, XCircle } from "lucide-react";

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
  const llmDone = progress.phase === "deep_analyzing" && progress.totalChunks > 0 && progress.currentChunk >= progress.totalChunks;
  const chunkText =
    progress.phase === "deep_analyzing" && progress.totalChunks > 0
      ? llmDone ? " (완료)" : ` (${progress.currentChunk}/${progress.totalChunks} 단계)`
      : "";

  // Rough percentage for shimmer bar
  const pct =
    progress.phase === "queued" ? 5
    : progress.phase === "quick_sast" ? 25
    : progress.phase === "quick_graphing" ? 45
    : progress.phase === "quick_complete" ? 55
    : progress.phase === "deep_submitting" ? 65
    : progress.phase === "deep_retrying" ? 70
    : progress.phase === "deep_analyzing"
      ? 70 + (progress.totalChunks > 0 ? (progress.currentChunk / progress.totalChunks) * 20 : 10)
    : 100;

  return (
    <div className="active-analysis-banner card">
      <div className="active-analysis-banner__content">
        <Loader2 size={16} className="spin" />
        <span className="active-analysis-banner__text">
          {progress.totalFiles ? `${progress.processedFiles ?? 0}/${progress.totalFiles}개 파일 ` : ""}분석 진행 중 — {phaseText}{chunkText}
        </span>
        {(progress.buildTargetId || progress.executionId) && (
          <span className="active-analysis-banner__text">
            {progress.buildTargetId ? `BuildTarget ${progress.buildTargetId}` : ""}
            {progress.buildTargetId && progress.executionId ? " · " : ""}
            {progress.executionId ? `Execution ${progress.executionId}` : ""}
          </span>
        )}
        <div className="active-analysis-banner__actions">
          <button className="btn btn-secondary btn-sm" onClick={onView}>
            <Eye size={14} />
            보기
          </button>
          <button className="btn btn-secondary btn-sm btn-danger" onClick={onAbort}>
            <XCircle size={14} />
            중단
          </button>
        </div>
      </div>
      <div className="active-analysis-banner__bar">
        <div className="active-analysis-banner__bar-fill shimmer-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
