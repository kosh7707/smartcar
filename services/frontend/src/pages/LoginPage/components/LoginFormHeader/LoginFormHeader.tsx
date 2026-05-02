import "./LoginFormHeader.css";
import React from "react";

export const LoginFormHeader: React.FC = () => (
  <div className="form-header chore c-4">
    <span className="eyebrow"><span className="env-dot"></span>AEGIS · PRODUCTION</span>
    <h2>로그인</h2>
    <div className="meta">
      <span>kr-aegis-01.prod</span>
      <span className="sep">·</span>
      <span>v1.4.2</span>
      <span className="sep">·</span>
      <span>SSO OPTIONAL</span>
    </div>
  </div>
);
