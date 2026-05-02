import "./SignupFormHeader.css";
import React from "react";

export const SignupFormHeader: React.FC = () => (
  <div className="form-header chore c-4">
    <span className="eyebrow"><span className="env-dot"></span>AEGIS · ACCESS REQUEST</span>
    <h2>회원가입</h2>
    <div className="meta">
      <span>관리자 승인 필요</span>
      <span className="sep">·</span>
      <span>ETA ~1 영업일</span>
      <span className="sep">·</span>
      <span>kr-aegis-01.prod</span>
    </div>
  </div>
);
