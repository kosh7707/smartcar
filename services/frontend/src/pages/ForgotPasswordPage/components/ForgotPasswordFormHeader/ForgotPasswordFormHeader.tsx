import "./ForgotPasswordFormHeader.css";
import React from "react";

export const ForgotPasswordFormHeader: React.FC = () => (
  <div className="form-header chore c-4">
    <span className="eyebrow"><span className="env-dot"></span>AEGIS · PASSWORD RESET</span>
    <h2>비밀번호 재설정</h2>
    <div className="meta">
      <span>이메일로 링크 발송</span>
      <span className="sep">·</span>
      <span>링크 만료 1시간</span>
    </div>
  </div>
);
