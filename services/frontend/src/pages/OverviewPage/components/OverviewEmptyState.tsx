import React from "react";
import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  Layers,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";

interface OverviewEmptyStateProps {
  onOpenFiles: () => void;
  onOpenSettings: () => void;
}

type StepState = "done" | "current" | "pending";

interface PrepStep {
  index: string;
  label: string;
  hint: string;
  state: StepState;
}

const PREP_STEPS: PrepStep[] = [
  { index: "01", label: "소스 업로드", hint: "다음 단계 · 파일/아카이브", state: "current" },
  { index: "02", label: "빌드 타깃 확인", hint: "자동 탐지 후 편집", state: "pending" },
  { index: "03", label: "분석 실행", hint: "정적 · Quick / Deep", state: "pending" },
];

interface PreviewTile {
  icon: React.ReactNode;
  title: string;
  caption: string;
}

const PREVIEW_TILES: PreviewTile[] = [
  { icon: <Shield aria-hidden="true" />, title: "보안 현황", caption: "CRITICAL · HIGH · MED · LOW" },
  { icon: <Layers aria-hidden="true" />, title: "빌드 타깃", caption: "READY / BUILDING / FAILED" },
  { icon: <ClipboardCheck aria-hidden="true" />, title: "품질 게이트", caption: "PASS · WARN · FAIL" },
  { icon: <TrendingUp aria-hidden="true" />, title: "분석 추세", caption: "NEW / RESOLVED / UNRESOLVED" },
  { icon: <Activity aria-hidden="true" />, title: "최근 활동", caption: "ANALYSIS · APPROVAL · SDK" },
  { icon: <Sparkles aria-hidden="true" />, title: "상위 Finding", caption: "TOP-5 · BY SEVERITY" },
];

export const OverviewEmptyState: React.FC<OverviewEmptyStateProps> = ({ onOpenFiles, onOpenSettings }) => (
  <section className="overview-empty" aria-label="분석 준비 상태">
    <div className="overview-empty__hero">
      <div className="overview-empty__anchor" aria-hidden="true">
        <div className="overview-empty__anchor-ring" />
        <svg className="overview-empty__shield" viewBox="0 0 44 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M22 1 L42 6 V24 C42 36 33 44 22 47 C11 44 2 36 2 24 V6 Z"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
            fill="oklch(1 0 0 / 0.02)"
          />
          <path
            d="M22 11 L30 15.5 V24.5 L22 29 L14 24.5 V15.5 Z"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
            opacity="0.5"
          />
        </svg>
        <span className="overview-empty__anchor-dot" />
      </div>

      <div className="overview-empty__body">
        <header className="overview-empty__eyebrow">
          <span className="overview-empty__eyebrow-dot" />
          <span>WORKSPACE · READY TO SCAN</span>
        </header>

        <h2 className="overview-empty__title">
          분석 준비 <em>완료</em>
        </h2>

        <p className="overview-empty__copy">
          소스를 업로드하면 빌드 타깃이 자동 탐지되고, 이 공간에 취약점 · 게이트 · 활동 피드가 순차적으로 채워집니다.
          첫 실행까지 남은 단계:
        </p>

        <ol className="overview-empty__steps" aria-label="분석 준비 단계">
          {PREP_STEPS.map((step) => (
            <li key={step.index} className={`overview-empty__step is-${step.state}`}>
              <span className="overview-empty__step-rail" aria-hidden="true" />
              <span className="overview-empty__step-marker" aria-hidden="true">
                {step.state === "done" ? "✓" : step.index}
              </span>
              <span className="overview-empty__step-copy">
                <span className="overview-empty__step-label">{step.label}</span>
                <span className="overview-empty__step-hint">{step.hint}</span>
              </span>
              {step.state === "current" ? (
                <span className="overview-empty__step-tag">NOW</span>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="overview-empty__actions">
          <button
            type="button"
            onClick={onOpenFiles}
            className="btn btn-primary btn-lg overview-empty__cta"
          >
            <Upload aria-hidden="true" />
            파일 업로드 시작
            <ArrowRight aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="btn btn-ghost btn-sm"
          >
            <Settings aria-hidden="true" />
            프로젝트 설정 열기
          </button>
        </div>
      </div>
    </div>

    <div className="overview-empty__preview" aria-hidden="true">
      <header className="overview-empty__preview-head">
        <span className="overview-empty__preview-eyebrow">ANALYSIS OUTPUT · AWAITING DATA</span>
        <span className="overview-empty__preview-rule" />
      </header>
      <div className="overview-empty__preview-grid">
        {PREVIEW_TILES.map((tile) => (
          <div key={tile.title} className="overview-empty__tile">
            <div className="overview-empty__tile-head">
              <span className="overview-empty__tile-icon">{tile.icon}</span>
              <span className="overview-empty__tile-title">{tile.title}</span>
            </div>
            <div className="overview-empty__tile-skeleton">
              <span className="overview-empty__tile-bar" style={{ width: "72%" }} />
              <span className="overview-empty__tile-bar" style={{ width: "48%" }} />
              <span className="overview-empty__tile-bar" style={{ width: "60%" }} />
            </div>
            <div className="overview-empty__tile-caption">{tile.caption}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
