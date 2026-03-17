import React, { useEffect, useState } from "react";
import type { AnalysisProgress } from "@smartcar/shared";
import { CheckCircle2, FileSearch, XCircle, Eye } from "lucide-react";
import { PageHeader, Spinner, BackButton, ConfirmDialog } from "../ui";
import "./AsyncAnalysisProgressView.css";

interface Props {
  progress: AnalysisProgress;
  onAbort: () => void;
  onViewResult: (analysisId: string) => void;
  onBack: () => void;
}

const STEPS = [
  { key: "queued", label: "대기" },
  { key: "rule_engine", label: "룰 엔진" },
  { key: "llm_chunk", label: "LLM 분석" },
  { key: "merging", label: "결과 병합" },
  { key: "complete", label: "완료" },
] as const;

const PHASE_INDEX: Record<string, number> = {
  queued: 0,
  rule_engine: 1,
  llm_chunk: 2,
  merging: 3,
  complete: 4,
};

export const AsyncAnalysisProgressView: React.FC<Props> = ({
  progress,
  onAbort,
  onViewResult,
  onBack,
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [autoRedirect, setAutoRedirect] = useState<number | null>(null);

  const isDone = progress.status === "completed" || progress.status === "failed" || progress.status === "aborted";

  useEffect(() => {
    const start = new Date(progress.startedAt).getTime();
    setElapsed(Math.floor((Date.now() - start) / 1000));
    if (isDone) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [progress.startedAt, isDone]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0
    ? `${mins}분 ${secs.toString().padStart(2, "0")}초`
    : `${secs}초`;

  // Auto-redirect countdown on completion
  useEffect(() => {
    if (progress.status !== "completed") return;
    setAutoRedirect(5);
    const id = setInterval(() => {
      setAutoRedirect((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [progress.status]);

  useEffect(() => {
    if (autoRedirect === 0) {
      onViewResult(progress.analysisId);
    }
  }, [autoRedirect, onViewResult, progress.analysisId]);

  const currentIdx = PHASE_INDEX[progress.phase] ?? 0;
  const isCompleted = progress.status === "completed";
  const isFailed = progress.status === "failed";
  const isAborted = progress.status === "aborted";
  const llmDone = progress.phase === "llm_chunk" && progress.totalChunks > 0 && progress.currentChunk >= progress.totalChunks;

  // Progress percentage
  const pct =
    isCompleted ? 100
    : isFailed || isAborted ? currentIdx * 20
    : progress.phase === "llm_chunk" && progress.totalChunks > 0
      ? 40 + (progress.currentChunk / progress.totalChunks) * 30
      : currentIdx * 20 + 10;

  return (
    <div className="page-enter">
      <BackButton onClick={onBack} label="대시보드로" />
      <PageHeader title="정적 분석" icon={<FileSearch size={20} />} />

      <div className="card async-progress">
        {!isDone && <Spinner size={40} />}

        <h3 className="async-progress__title">
          {isCompleted ? "분석 완료" : isFailed ? "분석 실패" : isAborted ? "분석 중단됨" : "분석 진행 중..."}
        </h3>

        {/* 5-step stepper */}
        <div className="async-stepper">
          {STEPS.map((s, i) => {
            const done = isCompleted ? true : currentIdx > i || (llmDone && i === currentIdx);
            const active = !isDone && currentIdx === i && !done;
            const failed = (isFailed || isAborted) && currentIdx === i;
            return (
              <React.Fragment key={s.key}>
                {i > 0 && (
                  <div className={`async-stepper__line${done ? " async-stepper__line--done" : ""}`} />
                )}
                <div className={`async-stepper__step${done ? " async-stepper__step--done" : active ? " async-stepper__step--active" : failed ? " async-stepper__step--failed" : ""}`}>
                  <div className="async-stepper__circle">
                    {done ? <CheckCircle2 size={18} /> : failed ? <XCircle size={18} /> : <span>{i + 1}</span>}
                  </div>
                  <span className="async-stepper__label">{s.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Chunk info */}
        {progress.phase === "llm_chunk" && progress.totalChunks > 0 && !isDone && !llmDone && (
          <p className="async-progress__chunk">
            {progress.totalFiles ? `${progress.processedFiles ?? 0} / ${progress.totalFiles}개 파일 진행 중 — ` : ""}LLM 분석 {progress.currentChunk} / {progress.totalChunks} 단계
          </p>
        )}

        {/* Progress bar */}
        <div className="async-progress__bar-wrap">
          <div className="async-progress__bar-track">
            <div
              className={`async-progress__bar-fill${!isDone ? " shimmer-fill" : isFailed || isAborted ? " async-progress__bar-fill--error" : ""}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="async-progress__percent">{Math.round(pct)}%</span>
        </div>

        {/* Message & time */}
        <p className="async-progress__message">{progress.message}</p>
        <p className="async-progress__elapsed">경과 시간: {timeStr}</p>

        {/* Error */}
        {isFailed && progress.error && (
          <p className="async-progress__error">{progress.error}</p>
        )}

        {/* Actions */}
        <div className="async-progress__actions">
          {isCompleted && (
            <button className="btn" onClick={() => onViewResult(progress.analysisId)}>
              <Eye size={16} />
              결과 보기{autoRedirect !== null && autoRedirect > 0 ? ` (${autoRedirect})` : ""}
            </button>
          )}
          {!isDone && (
            <button className="btn btn-secondary btn-danger" onClick={() => setShowAbortConfirm(true)}>
              <XCircle size={16} />
              분석 중단
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showAbortConfirm}
        title="분석 중단"
        message="진행 중인 분석을 중단하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="중단"
        danger
        onConfirm={() => { setShowAbortConfirm(false); onAbort(); }}
        onCancel={() => setShowAbortConfirm(false)}
      />
    </div>
  );
};
