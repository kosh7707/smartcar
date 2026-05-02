import "./StaticAnalysisEmptyState.css";
import React from "react";
import { ArrowRight, Upload } from "lucide-react";

interface StaticAnalysisEmptyStateProps {
  onUpload: () => void;
}

type StepState = "current" | "pending";

const PREP_STEPS: Array<{ index: string; label: string; hint: string; state: StepState }> = [
  { index: "01", label: "소스 업로드", hint: "아카이브 · .zip / .tar.gz / .tgz", state: "current" },
  { index: "02", label: "빌드 타겟 선택", hint: "자동 탐지된 타겟 확인", state: "pending" },
  { index: "03", label: "정적 분석 실행", hint: "Quick SAST → Deep Agent", state: "pending" },
];

export function StaticAnalysisEmptyState({ onUpload }: StaticAnalysisEmptyStateProps) {
  return (
    <div className="page-shell static-analysis-main" data-chore>
      <header className="page-head chore c-1">
        <div>
          <h1>정적 분석</h1>
          <div className="sub">
            <span className="sub-caps">AWAITING SOURCE</span>
            <span className="sep" aria-hidden="true">·</span>
            <span>소스를 업로드하면 Quick SAST와 Deep Agent 결과가 이 작업면에 채워집니다</span>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={onUpload}>
            <Upload aria-hidden="true" />
            소스 코드 업로드
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="chore c-2" aria-labelledby="prep-steps-head">
        <div className="section-head">
          <h2 id="prep-steps-head">
            준비 단계
            <span className="count">3</span>
          </h2>
          <span className="hint">STEP 01 / 03</span>
        </div>
        <ol className="prep-steps" aria-label="정적 분석 준비 단계">
          {PREP_STEPS.map((step) => (
            <li key={step.index} className={`prep-step prep-step--${step.state}`}>
              <span className="prep-step__marker" aria-hidden="true">
                {step.index}
              </span>
              <div className="prep-step__copy">
                <span className="prep-step__label">{step.label}</span>
                <span className="prep-step__hint">{step.hint}</span>
              </div>
              {step.state === "current" ? (
                <span className="prep-step__tag" aria-label="현재 단계">
                  NOW
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
