import "./SignupOrganizationSection.css";
import React from "react";
import { SignupOrgCodeField } from "../SignupOrgCodeField/SignupOrgCodeField";
import { SignupOrgVerifyResult } from "../SignupOrgVerifyResult/SignupOrgVerifyResult";

interface OrgVerificationState {
  status: "idle" | "checking" | "ok" | "bad";
  statusText: string;
  name: string;
  admin: string;
  region: string;
  role: string;
}

interface SignupOrganizationSectionProps {
  orgCode: string;
  verification: OrgVerificationState;
  onOrgCodeChange: (value: string) => void;
  onVerifyOrg: () => void;
}

export const SignupOrganizationSection: React.FC<SignupOrganizationSectionProps> = ({ orgCode, verification, onOrgCodeChange, onVerifyOrg }) => (
  <div className={`section-group chore c-8 ${verification.status !== "idle" ? "active" : ""}`} id="org-section">
    <div className="rail"><div className="num">02</div></div>
    <div className="body">
      <div className="section-header">
        <span className="title">조직 · 접근 범위</span>
      </div>
      <SignupOrgCodeField
        value={orgCode}
        verifyStatus={verification.status}
        onChange={onOrgCodeChange}
        onVerify={onVerifyOrg}
      />
      <SignupOrgVerifyResult verification={verification} />
    </div>
  </div>
);
