import "./SignupBrandHero.css";
import React from "react";
import { SignupOnboardingList } from "../SignupOnboardingList/SignupOnboardingList";

interface OnboardingStep {
  label: string;
  detail: string;
  current?: boolean;
}

interface SignupBrandHeroProps {
  steps: ReadonlyArray<OnboardingStep>;
}

export const SignupBrandHero: React.FC<SignupBrandHeroProps> = ({ steps }) => (
  <div className="brand-hero">
    <h1 className="chore c-2">계정 하나로<br /><em>분석부터 승인까지.</em></h1>
    <p className="chore c-3">정밀한 소스코드 분석과 시스템 검증으로, 개발 속도를 늦추지 않는 강력한 보안.</p>
    <div className="onboard-header chore c-4">
      <span className="label">onboarding · request flow</span>
      <span className="counter">step <span className="cur">01</span> / 04</span>
    </div>
    <SignupOnboardingList steps={steps} />
  </div>
);
