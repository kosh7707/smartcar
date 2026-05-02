import "./SignupOrgCodeField.css";
import React from "react";
import { Building2 } from "lucide-react";

interface SignupOrgCodeFieldProps {
  value: string;
  verifyStatus: "idle" | "checking" | "ok" | "bad";
  onChange: (value: string) => void;
  onVerify: () => void;
}

export const SignupOrgCodeField: React.FC<SignupOrgCodeFieldProps> = ({ value, verifyStatus, onChange, onVerify }) => (
  <div className="field">
    <label htmlFor="signup-org-code">
      <span>조직 코드</span>
      <span className="label-caps">CASE-SENSITIVE</span>
    </label>
    <div className="input-wrap">
      <Building2 className="leading" aria-hidden="true" />
      <input
        id="signup-org-code"
        className="input signup-org-input"
        type="text"
        placeholder="ACME-KR-SEC"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      <button
        id="org-verify-btn"
        data-state={verifyStatus}
        type="button"
        className="trailing-btn"
        onClick={onVerify}
        aria-label="조직 코드 검증"
      >
        verify
      </button>
    </div>
  </div>
);
