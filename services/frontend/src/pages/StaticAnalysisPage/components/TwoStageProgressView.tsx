import React, { useState } from "react";
import { AlertTriangle, CheckCircle, Loader, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="page-enter space-y-5">
      <PageHeader
        surface="plain"
        title={isComplete ? "분석 완료" : isError ? "분석 오류" : "분석 진행 중..."}
        subtitle={message || "빠른 분석과 심층 분석 단계를 순차적으로 진행합니다."}
        action={<span className="font-mono text-sm text-muted-foreground tabular-nums">{timeStr}</span>}
      />

      {(buildTargetId || executionId) && (
        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-5 py-3 text-sm">
          {buildTargetId && <span className="font-medium text-primary">BuildTarget: {buildTargetId}</span>}
          {executionId && <span className="font-semibold text-foreground tabular-nums">Execution: {executionId}</span>}
        </div>
      )}

      {targetProgress && targetProgress.total > 1 && (
        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-5 py-3 text-sm">
          <span className="font-medium text-primary">{targetName ? `[${targetName}]` : "타겟"} 분석 중</span>
          <span className="font-semibold text-foreground tabular-nums">{targetProgress.current} / {targetProgress.total} 타겟</span>
        </div>
      )}

      <Card className="shadow-none">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-0 px-2">
            {STAGES.map((s, i) => {
              const complete = isStageComplete(s.key, stage);
              const active = isStageActive(s.key, stage);
              const stageClass = complete ? "complete" : active ? "active" : "pending";

              return (
                <div key={s.key} className="relative flex items-start gap-5 pb-6 last:pb-0">
                  <div className={[
                    "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    complete ? "text-emerald-600 dark:text-emerald-300" : active ? "text-primary" : "text-muted-foreground",
                  ].join(" ")}>
                    {complete ? (
                      <CheckCircle size={24} />
                    ) : active ? (
                      <Loader size={24} className="animate-spin" />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border text-sm font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 pt-2">
                    <div className={[
                      "text-base font-semibold",
                      stageClass === "pending" ? "text-muted-foreground" : "text-foreground",
                    ].join(" ")}>
                      {s.label}
                    </div>
                    {s.key === "quick_sast" && complete && quickFindingCount !== null && (
                      <div className="mt-2 text-sm text-emerald-600 dark:text-emerald-300">{quickFindingCount}개 finding 발견</div>
                    )}
                    {s.key === "deep_analyzing" && complete && deepFindingCount !== null && (
                      <div className="mt-2 text-sm text-emerald-600 dark:text-emerald-300">{deepFindingCount}개 finding 추가 발견</div>
                    )}
                    {active && message && (
                      <div className="mt-2 text-sm text-muted-foreground">{message}</div>
                    )}
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className={[
                      "absolute left-[15px] top-9 bottom-0 w-0.5 rounded-sm",
                      complete ? "bg-emerald-500" : "bg-border",
                    ].join(" ")} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isError && error && (
        <Card className="border-destructive shadow-none">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-3 font-semibold text-destructive">
              <XCircle size={20} />
              <span>{errorPhase === "quick" ? "빠른 분석" : errorPhase === "deep" ? "심층 분석" : "분석"} 중 오류 발생</span>
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            {retryable && <Button onClick={onRetry}>다시 시도</Button>}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-4">
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

      {(stage === "deep_submitting" || stage === "deep_analyzing") && (
        <Card className="shadow-none">
          <CardContent className="flex items-center gap-4 px-5 py-4 text-sm text-muted-foreground">
            <CheckCircle size={16} className="shrink-0 text-emerald-600 dark:text-emerald-300" />
            <span>빠른 분석 결과가 준비되었습니다.</span>
            <Button variant="outline" size="sm" onClick={onViewResults}>먼저 확인하기</Button>
          </CardContent>
        </Card>
      )}

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
