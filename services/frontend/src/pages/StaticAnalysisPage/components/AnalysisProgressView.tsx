import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useElapsedTimer } from "../../../hooks/useElapsedTimer";
import { PageHeader, Spinner } from "../../../shared/ui";

interface Props {
  progress: number;
  step: string;
}

const STEPS = [
  { label: "파일 업로드", threshold: 30 },
  { label: "분석 실행", threshold: 70 },
  { label: "결과 처리", threshold: 100 },
];

export const AnalysisProgressView: React.FC<Props> = ({ progress, step }) => {
  const { timeStr } = useElapsedTimer(true);

  return (
    <div className="page-enter">
      <PageHeader title="정적 분석" />

      <Card className="shadow-none">
        <CardContent className="space-y-5 px-8 py-10 text-center">
          <div className="flex justify-center">
            <Spinner size={40} />
          </div>

          <h3 className="text-lg font-semibold text-foreground">분석 진행 중...</h3>

          <div className="mb-7 flex items-start justify-center gap-0">
            {STEPS.map((s, i) => {
              const done = progress >= s.threshold;
              const active = !done && (i === 0 || progress >= STEPS[i - 1].threshold);
              return (
                <React.Fragment key={s.label}>
                  {i > 0 && (
                    <div
                      className={[
                        "mt-[14px] h-0.5 w-12 shrink-0 rounded-sm bg-border/80 transition-colors",
                        progress >= STEPS[i - 1].threshold ? "bg-emerald-500" : "",
                      ].join(" ")}
                    />
                  )}
                  <div className="flex min-w-20 flex-col items-center gap-2">
                    <div
                      className={[
                        "flex h-7 w-7 items-center justify-center rounded-full border-2 bg-background text-xs font-semibold transition-all",
                        done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : active
                            ? "border-primary text-primary shadow-[0_0_0_3px_var(--cds-interactive-subtle)]"
                            : "border-border text-muted-foreground",
                      ].join(" ")}
                    >
                      {done ? <CheckCircle2 size={18} /> : <span>{i + 1}</span>}
                    </div>
                    <span
                      className={[
                        "whitespace-nowrap text-xs",
                        done
                          ? "text-emerald-600 dark:text-emerald-300"
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

          <div className="mx-auto mb-4 flex max-w-[400px] items-center gap-4">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/70">
              <div
                className="shimmer-fill h-full rounded-full bg-[linear-gradient(90deg,var(--cds-interactive),var(--cds-interactive-hover))] transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="min-w-9 text-right text-sm font-semibold text-primary">
              {progress}%
            </span>
          </div>

          <p className="text-sm text-muted-foreground">{step}</p>
          <p className="text-sm text-muted-foreground">경과 시간: {timeStr}</p>
        </CardContent>
      </Card>
    </div>
  );
};
