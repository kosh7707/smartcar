import React from "react";
import type { AnalysisProgress } from "@smartcar/shared";
import { Loader2, Eye, XCircle } from "lucide-react";

interface Props {
  progress: AnalysisProgress;
  onView: () => void;
  onAbort: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  queued: "대기 중",
  rule_engine: "룰 엔진 분석",
  llm_chunk: "LLM 분석",
  merging: "결과 병합",
  complete: "완료",
};

export const ActiveAnalysisBanner: React.FC<Props> = ({ progress, onView, onAbort }) => {
  const phaseText = PHASE_LABELS[progress.phase] ?? progress.phase;
  const llmDone = progress.phase === "llm_chunk" && progress.totalChunks > 0 && progress.currentChunk >= progress.totalChunks;
  const chunkText =
    progress.phase === "llm_chunk" && progress.totalChunks > 0
      ? llmDone ? " (완료)" : ` (${progress.currentChunk}/${progress.totalChunks} 단계)`
      : "";

  // Rough percentage for shimmer bar
  const pct =
    progress.phase === "queued" ? 5
    : progress.phase === "rule_engine" ? 25
    : progress.phase === "llm_chunk"
      ? 30 + (progress.totalChunks > 0 ? (progress.currentChunk / progress.totalChunks) * 50 : 30)
    : progress.phase === "merging" ? 90
    : 100;

  return (
    <div className="active-analysis-banner card">
      <div className="active-analysis-banner__content">
        <Loader2 size={16} className="spin" />
        <span className="active-analysis-banner__text">
          {progress.totalFiles ? `${progress.processedFiles ?? 0}/${progress.totalFiles}개 파일 ` : ""}분석 진행 중 — {phaseText}{chunkText}
        </span>
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
