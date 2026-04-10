import React from "react";
import { CheckCircle2, FileSearch } from "lucide-react";
import { useElapsedTimer } from "../../hooks/useElapsedTimer";
import { PageHeader, Spinner } from "../ui";
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
    <div className="page-enter">
      <PageHeader title="정적 분석" icon={<FileSearch size={20} />} />

      <div className="card analysis-progress">
        <Spinner size={40} />

        <h3 className="analysis-progress__title">분석 진행 중...</h3>

        {/* Stepper */}
        <div className="analysis-stepper">
          {STEPS.map((s, i) => {
            const done = progress >= s.threshold;
            const active = !done && (i === 0 || progress >= STEPS[i - 1].threshold);
            return (
              <React.Fragment key={s.label}>
                {i > 0 && (
                  <div className={`analysis-stepper__line${progress >= STEPS[i - 1].threshold ? " analysis-stepper__line--done" : ""}`} />
                )}
                <div className={`analysis-stepper__step${done ? " analysis-stepper__step--done" : active ? " analysis-stepper__step--active" : ""}`}>
                  <div className="analysis-stepper__circle">
                    {done ? <CheckCircle2 size={18} /> : <span>{i + 1}</span>}
                  </div>
                  <span className="analysis-stepper__label">{s.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="analysis-progress__bar-wrap">
          <div className="analysis-progress__bar-track">
            <div className="analysis-progress__bar-fill shimmer-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="analysis-progress__percent">{progress}%</span>
        </div>

        {/* Step description & elapsed time */}
        <p className="analysis-progress__step">{step}</p>
        <p className="analysis-progress__elapsed">경과 시간: {timeStr}</p>
      </div>
    </div>
  );
};
