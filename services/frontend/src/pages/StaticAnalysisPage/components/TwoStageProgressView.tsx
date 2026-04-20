import React, { useState } from "react";
import { AlertTriangle, CheckCircle, Loader, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AnalysisStage } from "../../../hooks/useAnalysisWebSocket";
import { useElapsedTimer } from "../../../hooks/useElapsedTimer";
import { ConfirmDialog, PageHeader } from "../../../shared/ui";

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
    <div className="two-stage-shell">
      <PageHeader
        surface="plain"
        title={isComplete ? "분석 완료" : isError ? "분석 오류" : "분석 진행 중..."}
        subtitle={message || "빠른 분석과 심층 분석 단계를 순차적으로 진행합니다."}
        action={<span className="two-stage-timer">{timeStr}</span>}
      />

      {buildTargetId || executionId ? (
        <div className="two-stage-meta-banner">
          {buildTargetId ? <span className="two-stage-meta-primary">BuildTarget: {buildTargetId}</span> : null}
          {executionId ? <span className="two-stage-meta-secondary">Execution: {executionId}</span> : null}
        </div>
      ) : null}

      {targetProgress && targetProgress.total > 1 ? (
        <div className="two-stage-meta-banner">
          <span className="two-stage-meta-primary">
            {targetName ? `[${targetName}]` : "타겟"} 분석 중
          </span>
          <span className="two-stage-meta-secondary">
            {targetProgress.current} / {targetProgress.total} 타겟
          </span>
        </div>
      ) : null}

      <Card className="two-stage-progress-card">
        <CardContent className="two-stage-progress-body">
          <div className="two-stage-steps">
            {STAGES.map((stageInfo, index) => {
              const complete = isStageComplete(stageInfo.key, stage);
              const active = isStageActive(stageInfo.key, stage);
              const stateClass = complete ? "is-complete" : active ? "is-active" : "is-pending";

              return (
                <div key={stageInfo.key} className="two-stage-step">
                  <div className={cn("two-stage-step-marker", stateClass)}>
                    {complete ? (
                      <CheckCircle size={24} />
                    ) : active ? (
                      <Loader size={24} className="two-stage-step-spinner" />
                    ) : (
                      <span className="two-stage-step-index">{index + 1}</span>
                    )}
                  </div>
                  <div className="two-stage-step-copy">
                    <div className={cn("two-stage-step-title", stateClass === "is-pending" && "is-muted")}>
                      {stageInfo.label}
                    </div>
                    {stageInfo.key === "quick_sast" && complete && quickFindingCount !== null ? (
                      <div className="two-stage-step-success">{quickFindingCount}개 finding 발견</div>
                    ) : null}
                    {stageInfo.key === "deep_analyzing" && complete && deepFindingCount !== null ? (
                      <div className="two-stage-step-success">{deepFindingCount}개 finding 추가 발견</div>
                    ) : null}
                    {active && message ? <div className="two-stage-step-message">{message}</div> : null}
                  </div>
                  {index < STAGES.length - 1 ? (
                    <div className={cn("two-stage-step-line", complete && "is-complete")} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isError && error ? (
        <Card className="two-stage-error-card">
          <CardContent className="two-stage-error-body">
            <div className="two-stage-error-head">
              <XCircle size={20} />
              <span>
                {errorPhase === "quick" ? "빠른 분석" : errorPhase === "deep" ? "심층 분석" : "분석"} 중 오류 발생
              </span>
            </div>
            <p className="two-stage-error-copy">{error}</p>
            {retryable ? <Button onClick={onRetry}>다시 시도</Button> : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="two-stage-actions">
        {isComplete ? (
          <Button onClick={onViewResults}>결과 보기</Button>
        ) : isError ? (
          <Button variant="outline" onClick={onBack}>돌아가기</Button>
        ) : (
          <Button variant="destructive" onClick={() => setShowAbortConfirm(true)}>
            <AlertTriangle size={14} />
            분석 중단
          </Button>
        )}
      </div>

      {stage === "deep_submitting" || stage === "deep_analyzing" ? (
        <Card className="two-stage-handoff-card">
          <CardContent className="two-stage-handoff-body">
            <CheckCircle size={16} className="two-stage-handoff-icon" />
            <span>빠른 분석 결과가 준비되었습니다.</span>
            <Button variant="outline" size="sm" onClick={onViewResults}>먼저 확인하기</Button>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={showAbortConfirm}
        title="분석 중단"
        message="진행 중인 분석을 중단하시겠습니까?"
        confirmLabel="중단"
        danger
        onConfirm={() => {
          setShowAbortConfirm(false);
          onBack();
        }}
        onCancel={() => setShowAbortConfirm(false)}
      />
    </div>
  );
};
