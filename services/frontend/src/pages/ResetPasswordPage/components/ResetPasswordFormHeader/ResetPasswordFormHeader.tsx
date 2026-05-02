import "./ResetPasswordFormHeader.css";
import React from "react";

export const ResetPasswordFormHeader: React.FC = () => (
  <div className="form-header chore c-4">
    <span className="eyebrow"><span className="env-dot"></span>AEGIS · PASSWORD RESET</span>
    <h2>새 비밀번호 설정</h2>
    <div className="meta">
      <span>재설정 링크로 접근</span>
      <span className="sep">·</span>
      <span>8자 이상</span>
    </div>
  </div>
);
