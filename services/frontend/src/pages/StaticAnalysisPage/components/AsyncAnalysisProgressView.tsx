import React, { useEffect, useState } from "react";
import type { AnalysisProgress } from "@aegis/shared";
import { CheckCircle2, Eye, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useElapsedTimer } from "../../../hooks/useElapsedTimer";
import { BackButton, ConfirmDialog, PageHeader, Spinner } from "../../../shared/ui";

interface Props {
  progress: AnalysisProgress;
  onAbort: () => void;
  onViewResult: (analysisId: string) => void;
  onBack: () => void;
}

const STEPS = [
  { key: "queued", label: "파일 추출" },
  { key: "rule_engine", label: "룰 분석" },
  { key: "llm_chunk", label: "AI 분석" },
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
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [autoRedirect, setAutoRedirect] = useState<number | null>(null);

  const isDone =
    progress.status === "completed" ||
    progress.status === "failed" ||
    progress.status === "aborted";
  const { timeStr } = useElapsedTimer(!isDone, progress.startedAt);

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
  const llmDone =
    progress.phase === "llm_chunk" &&
    progress.totalChunks > 0 &&
    progress.currentChunk >= progress.totalChunks;

  const DEFAULT_WEIGHTS = {
    queued: 5,
    rule_engine: 5,
    llm_chunk: 80,
    merging: 10,
  };
  const w =
    ((progress as Record<string, unknown>).phaseWeights as Record<string, number> | undefined) ??
    DEFAULT_WEIGHTS;
  const cum = {
    rule_engine: w.queued,
    llm_chunk: w.queued + w.rule_engine,
    merging: w.queued + w.rule_engine + w.llm_chunk,
  };

  const calcPhaseProgress = (): number => {
    switch (progress.phase) {
      case "queued":
        return w.queued / 2;
      case "rule_engine":
        return cum.rule_engine + w.rule_engine / 2;
      case "llm_chunk":
        return progress.totalChunks > 0
          ? cum.llm_chunk + (progress.currentChunk / progress.totalChunks) * w.llm_chunk
          : cum.llm_chunk;
      case "merging":
        return cum.merging + w.merging / 2;
      case "complete":
        return 100;
      default:
        return 0;
    }
  };
  const pct = isCompleted ? 100 : calcPhaseProgress();

  return (
    <div className="page-enter">
      <BackButton onClick={onBack} label="대시보드로" />
      <PageHeader title="정적 분석" />

      <Card className="shadow-none">
        <CardContent className="space-y-5 px-8 py-10 text-center">
          {!isDone && (
            <div className="flex justify-center">
              <Spinner size={40} />
            </div>
          )}

          <h3 className="text-lg font-semibold text-foreground">
            {isCompleted
              ? "분석 완료"
              : isFailed
                ? "분석 실패"
                : isAborted
                  ? "분석 중단됨"
                  : "분석 진행 중..."}
          </h3>

          <div className="mb-7 flex items-start justify-center gap-0">
            {STEPS.map((s, i) => {
              const done = isCompleted ? true : currentIdx > i || (llmDone && i === currentIdx);
              const active = !isDone && currentIdx === i && !done;
              const failed = (isFailed || isAborted) && currentIdx === i;
              return (
                <React.Fragment key={s.key}>
                  {i > 0 && (
                    <div
                      className={[
                        "mt-[14px] h-0.5 w-9 shrink-0 rounded-sm bg-border/80 transition-colors",
                        done ? "bg-emerald-500" : "",
                      ].join(" ")}
                    />
                  )}
                  <div className="flex min-w-16 flex-col items-center gap-2">
                    <div
                      className={[
                        "flex h-7 w-7 items-center justify-center rounded-full border-2 bg-background text-xs font-semibold transition-all",
                        done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : failed
                            ? "border-[var(--aegis-severity-critical)] bg-[var(--aegis-severity-critical)] text-white"
                            : active
                              ? "border-primary text-primary shadow-[0_0_0_3px_var(--cds-interactive-subtle)]"
                              : "border-border text-muted-foreground",
                      ].join(" ")}
                    >
                      {done ? <CheckCircle2 size={18} /> : failed ? <XCircle size={18} /> : <span>{i + 1}</span>}
                    </div>
                    <span
                      className={[
                        "whitespace-nowrap text-xs",
                        done
                          ? "text-emerald-600 dark:text-emerald-300"
                          : failed
                            ? "text-[var(--aegis-severity-critical)]"
                            : active
                              ? "font-medium text-foreground"
                              : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {s.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {progress.phase === "llm_chunk" && progress.totalChunks > 0 && !isDone && !llmDone && (
            <p className="mb-5 text-sm font-medium text-primary">
              {progress.totalFiles
                ? `${progress.processedFiles ?? 0} / ${progress.totalFiles}개 파일 진행 중 — `
                : ""}
              LLM 분석 {progress.currentChunk} / {progress.totalChunks} 단계
            </p>
          )}

          <div className="mx-auto mb-4 flex max-w-[400px] items-center gap-4">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/70">
              <div
                className={[
                  "h-full rounded-full transition-[width]",
                  !isDone
                    ? "shimmer-fill bg-[linear-gradient(90deg,var(--cds-interactive),var(--cds-interactive-hover))]"
                    : isFailed || isAborted
                      ? "bg-[var(--aegis-severity-critical)]"
                      : "bg-[linear-gradient(90deg,var(--cds-interactive),var(--cds-interactive-hover))]",
                ].join(" ")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="min-w-9 text-right text-sm font-semibold text-primary">
              {Math.round(pct)}%
            </span>
          </div>

          <p className="text-sm text-muted-foreground">{progress.message}</p>
          <p className="text-sm text-muted-foreground">경과 시간: {timeStr}</p>

          {isFailed && progress.error && (
            <p className="mx-auto mb-5 max-w-[400px] rounded-lg bg-[var(--aegis-severity-critical-bg)] px-5 py-4 text-sm text-[var(--aegis-severity-critical)]">
              {progress.error}
            </p>
          )}

          <div className="mt-3 flex justify-center gap-4">
            {isCompleted && (
              <Button onClick={() => onViewResult(progress.analysisId)}>
                <Eye size={16} />
                결과 보기
                {autoRedirect !== null && autoRedirect > 0 ? ` (${autoRedirect})` : ""}
              </Button>
            )}
            {!isDone && (
              <Button variant="destructive" onClick={() => setShowAbortConfirm(true)}>
                <XCircle size={16} />
                분석 중단
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {(progress.phase === "deep_submitting" || progress.phase === "deep_analyzing") && (
        <Card className="mt-5 shadow-none">
          <CardContent className="flex items-center gap-3 px-5 py-4 text-sm text-muted-foreground">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-300" />
            <span>빠른 분석 결과가 준비되었습니다.</span>
            <Button variant="outline" size="sm" onClick={onViewResult}>
              먼저 확인하기
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={showAbortConfirm}
        title="분석 중단"
        message="진행 중인 분석을 중단하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="중단"
        danger
        onConfirm={() => {
          setShowAbortConfirm(false);
          onAbort();
        }}
        onCancel={() => setShowAbortConfirm(false)}
      />
    </div>
  );
};
