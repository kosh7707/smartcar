import React from "react";
import { CheckCircle2 } from "lucide-react";
import { useElapsedTimer } from "../../../hooks/useElapsedTimer";
import { PageHeader, Spinner } from "../../../shared/ui";
import "./AnalysisProgressView.css";

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
    <div className="page-shell analysis-progress-view">
      <PageHeader title="정적 분석" />

      <div className="panel analysis-progress-view__card">
        <div className="panel-body analysis-progress-view__body">
          <div className="analysis-progress-view__spinner">
            <Spinner size={40} />
          </div>

          <h3 className="analysis-progress-view__title">분석 진행 중...</h3>

          <div className="analysis-progress-view__steps">
            {STEPS.map((s, i) => {
              const done = progress >= s.threshold;
              const active = !done && (i === 0 || progress >= STEPS[i - 1].threshold);
              return (
                <React.Fragment key={s.label}>
                  {i > 0 && (
                    <div
                      className={[
                        "analysis-progress-view__step-connector",
                        progress >= STEPS[i - 1].threshold ? "is-complete" : "",
                      ].join(" ")}
                    />
                  )}
                  <div className="analysis-progress-view__step">
                    <div
                      className={[
                        "analysis-progress-view__step-indicator",
                        done
                          ? "is-complete"
                          : active
                            ? "is-active"
                            : "is-pending",
                      ].join(" ")}
                    >
                      {done ? <CheckCircle2 size={18} /> : <span>{i + 1}</span>}
                    </div>
                    <span
                      className={[
                        "analysis-progress-view__step-label",
                        done
                          ? "is-complete"
                          : active
                            ? "is-active"
                            : "is-pending",
                      ].join(" ")}
                    >
                      {s.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <div className="analysis-progress-view__progress-row">
            <div className="analysis-progress-view__progress-track">
              <div
                className="analysis-progress-view__progress-fill shimmer-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="analysis-progress-view__progress-value">
              {progress}%
            </span>
          </div>

          <p className="analysis-progress-view__message">{step}</p>
          <p className="analysis-progress-view__message">경과 시간: {timeStr}</p>
        </div>
      </div>
    </div>
  );
};
