import "./SignupOrgVerifyResult.css";
import React from "react";

interface OrgVerificationState {
  status: "idle" | "checking" | "ok" | "bad";
  statusText: string;
  name: string;
  admin: string;
  region: string;
  role: string;
}

interface SignupOrgVerifyResultProps {
  verification: OrgVerificationState;
}

export const SignupOrgVerifyResult: React.FC<SignupOrgVerifyResultProps> = ({ verification }) => (
  <div className="org-verify" data-state={verification.status}>
    <div className="status"><span className="dot"></span><span>{verification.statusText}</span></div>
    <div className="row"><span className="k">조직명</span><span className="v">{verification.name}</span></div>
    <div className="row"><span className="k">관리자</span><span className="v mono">{verification.admin}</span></div>
    <div className="row"><span className="k">리전</span><span className="v mono">{verification.region}</span></div>
    <div className="row"><span className="k">배정 역할</span><span className="v">{verification.role}</span></div>
  </div>
);
