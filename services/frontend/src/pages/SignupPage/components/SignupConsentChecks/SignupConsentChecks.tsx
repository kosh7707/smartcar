import "./SignupConsentChecks.css";
import React from "react";
import { Check } from "lucide-react";

interface SignupConsentChecksProps {
  termsAccepted: boolean;
  auditAccepted: boolean;
  onTermsAcceptedChange: (checked: boolean) => void;
  onAuditAcceptedChange: (checked: boolean) => void;
}

export const SignupConsentChecks: React.FC<SignupConsentChecksProps> = ({
  termsAccepted,
  auditAccepted,
  onTermsAcceptedChange,
  onAuditAcceptedChange,
}) => (
  <div className="chore c-9 signup-consent-stack">
    <label className="checkbox-row">
      <input type="checkbox" checked={termsAccepted} onChange={(event) => onTermsAcceptedChange(event.target.checked)} />
      <span className="box"><Check /></span>
      <span>
        <button type="button" onClick={(event) => event.preventDefault()}>서비스 이용 약관</button>과{" "}
        <button type="button" onClick={(event) => event.preventDefault()}>개인정보 처리방침</button>에 동의합니다.{" "}
        <span className="signup-required-marker">*</span>
      </span>
    </label>
    <label className="checkbox-row">
      <input type="checkbox" checked={auditAccepted} onChange={(event) => onAuditAcceptedChange(event.target.checked)} />
      <span className="box"><Check /></span>
      <span>계정 활동은 감사 목적으로 기록되며, 조직 관리자가 열람할 수 있음을 이해합니다. <span className="signup-required-marker">*</span></span>
    </label>
  </div>
);
