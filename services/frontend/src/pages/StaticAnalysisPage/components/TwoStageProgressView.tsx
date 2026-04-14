import React, { useState } from "react";
import { CheckCircle, AlertTriangle, Loader, XCircle } from "lucide-react";
import type { AnalysisStage } from "../../../hooks/useAnalysisWebSocket";
import { useElapsedTimer } from "../../../hooks/useElapsedTimer";
import { ConfirmDialog, PageHeader } from "../../../shared/ui";
import "./TwoStageProgressView.css";

interface Props {
  analysisId: string | null;
  buildTargetId?: string | null;
  executionId?: string | null;
  stage: AnalysisStage;
  message: string;
  quickFindingCount: number | null;
  deepFindingCount: number | null;
  error: string | null;
  errorPhase: "quick" | "deep" | null;
  retryable: boolean;
  targetName?: string | null;
  targetProgress?: { current: number; total: number } | null;
  onRetry: () => void;
  onViewResults: () => void;
  onBack: () => void;
}

const STAGES: { key: AnalysisStage; label: string }[] = [
  { key: "quick_sast", label: "빠른 분석 (SAST)" },
  { key: "deep_analyzing", label: "심층 분석 (Agent)" },
];

function isStageComplete(stageKey: string, currentStage: AnalysisStage): boolean {
  if (stageKey === "quick_sast") {
    return ["quick_complete", "deep_submitting", "deep_analyzing", "deep_retrying", "deep_complete"].includes(currentStage);
  }
  if (stageKey === "deep_analyzing") {
    return currentStage === "deep_complete";
  }
  return false;
}

function isStageActive(stageKey: string, currentStage: AnalysisStage): boolean {
  if (stageKey === "quick_sast") {
    return currentStage === "quick_sast" || currentStage === "quick_graphing";
  }
  if (stageKey === "deep_analyzing") {
    return currentStage === "deep_submitting" || currentStage === "deep_analyzing" || currentStage === "deep_retrying";
  }
  return false;
}

export const TwoStageProgressView: React.FC<Props> = ({
  analysisId,
  buildTargetId,
  executionId,
  stage,
  message,
  quickFindingCount,
  deepFindingCount,
  error,
  errorPhase,
  retryable,
  targetName,
  targetProgress,
  onRetry,
  onViewResults,
  onBack,
}) => {
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const timerActive = stage !== "deep_complete" && stage !== "error" && stage !== "idle";
  const { timeStr } = useElapsedTimer(timerActive, analysisId);

  const isComplete = stage === "deep_complete";
  const isError = stage === "error";

  return (
    <div className="page-enter two-stage-progress">
      <PageHeader
        surface="plain"
        title={isComplete ? "분석 완료" : isError ? "분석 오류" : "분석 진행 중..."}
        subtitle={message || "빠른 분석과 심층 분석 단계를 순차적으로 진행합니다."}
        action={<span className="two-stage-elapsed">{timeStr}</span>}
      />

      {(buildTargetId || executionId) && (
        <div className="two-stage-target-info">
          {buildTargetId && (
            <span className="two-stage-target-name">BuildTarget: {buildTargetId}</span>
          )}
          {executionId && (
            <span className="two-stage-target-progress">Execution: {executionId}</span>
          )}
        </div>
      )}

      {/* Target progress (multi-target only) */}
      {targetProgress && targetProgress.total > 1 && (
        <div className="two-stage-target-info">
          <span className="two-stage-target-name">
            {targetName ? `[${targetName}]` : "타겟"} 분석 중
          </span>
          <span className="two-stage-target-progress">
            {targetProgress.current} / {targetProgress.total} 타겟
          </span>
        </div>
      )}

      {/* Stepper */}
      <div className="card two-stage-stepper">
        {STAGES.map((s, i) => {
          const complete = isStageComplete(s.key, stage);
          const active = isStageActive(s.key, stage);
          const stageClass = complete ? "complete" : active ? "active" : "pending";

          return (
            <div key={s.key} className={`two-stage-step two-stage-step--${stageClass}`}>
              <div className="two-stage-step__indicator">
                {complete ? (
                  <CheckCircle size={24} />
                ) : active ? (
                  <Loader size={24} className="animate-spin" />
                ) : (
                  <span className="two-stage-step__number">{i + 1}</span>
                )}
              </div>
              <div className="two-stage-step__body">
                <div className="two-stage-step__label">{s.label}</div>
                {/* Quick results inline */}
                {s.key === "quick_sast" && complete && quickFindingCount !== null && (
                  <div className="two-stage-step__result">
                    {quickFindingCount}개 finding 발견
                  </div>
                )}
                {/* Deep results inline */}
                {s.key === "deep_analyzing" && complete && deepFindingCount !== null && (
                  <div className="two-stage-step__result">
                    {deepFindingCount}개 finding 추가 발견
                  </div>
                )}
                {/* Active message */}
                {active && message && (
                  <div className="two-stage-step__message">{message}</div>
                )}
              </div>
              {i < STAGES.length - 1 && (
                <div className={`two-stage-connector${complete ? " two-stage-connector--complete" : ""}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Error state */}
      {isError && error && (
        <div className="card two-stage-error">
          <div className="two-stage-error__header">
            <XCircle size={20} />
            <span>
              {errorPhase === "quick" ? "빠른 분석" : errorPhase === "deep" ? "심층 분석" : "분석"} 중 오류 발생
            </span>
          </div>
          <p className="two-stage-error__message">{error}</p>
          {retryable && (
            <button className="btn" onClick={onRetry}>
              다시 시도
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="two-stage-actions">
        {isComplete ? (
          <button className="btn" onClick={onViewResults}>
            결과 보기
          </button>
        ) : isError ? (
          <button className="btn btn-secondary" onClick={onBack}>
            돌아가기
          </button>
        ) : (
          <button className="btn btn-secondary btn-danger" onClick={() => setShowAbortConfirm(true)}>
            <AlertTriangle size={14} />
            분석 중단
          </button>
        )}
      </div>

      {/* Quick complete — intermediate CTA */}
      {stage === "deep_submitting" || stage === "deep_analyzing" ? (
        <div className="two-stage-quick-cta card">
          <CheckCircle size={16} className="two-stage-quick-cta__icon" />
          <span>빠른 분석 결과가 준비되었습니다.</span>
          <button className="btn btn-secondary btn-sm" onClick={onViewResults}>
            먼저 확인하기
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={showAbortConfirm}
        title="분석 중단"
        message="진행 중인 분석을 중단하시겠습니까?"
        confirmLabel="중단"
        danger
        onConfirm={() => { setShowAbortConfirm(false); onBack(); }}
        onCancel={() => setShowAbortConfirm(false)}
      />
    </div>
  );
};
