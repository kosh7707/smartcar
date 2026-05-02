import "./SignupOnboardingList.css";
import React from "react";

interface OnboardingStep {
  label: string;
  detail: string;
  current?: boolean;
}

interface SignupOnboardingListProps {
  steps: ReadonlyArray<OnboardingStep>;
}

export const SignupOnboardingList: React.FC<SignupOnboardingListProps> = ({ steps }) => (
  <div className="onboard-list chore c-4">
    {steps.map((step, index) => (
      <div className={`onboard-item ${step.current ? "current" : "upcoming"}`} key={step.label}>
        <div className="step">{step.current ? "" : index + 1}</div>
        <div className="body">
          <div className="title-row">
            <span className="title">{step.label}</span>
            {step.current ? <span className="now-tag">NOW</span> : null}
          </div>
          <div className="desc">{step.detail}</div>
        </div>
      </div>
    ))}
  </div>
);
