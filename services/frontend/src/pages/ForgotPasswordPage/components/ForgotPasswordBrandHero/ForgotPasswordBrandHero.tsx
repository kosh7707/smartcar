import "./ForgotPasswordBrandHero.css";
import React from "react";

interface ForgotPasswordBrandHeroProps {
  statusRows: ReadonlyArray<{ key: string; value: string }>;
}

export const ForgotPasswordBrandHero: React.FC<ForgotPasswordBrandHeroProps> = ({ statusRows }) => (
  <div className="brand-hero">
    <h1 className="chore c-2">비밀번호를 <em>잊으셨나요?</em></h1>
    <p className="chore c-3">가입하신 업무용 이메일로 재설정 링크를 보내드립니다. 받은 링크에서 새 비밀번호를 설정해 주세요.</p>
    <dl className="status-block chore c-4">
      {statusRows.map((row) => (
        <div className="row lit" key={row.key}>
          <dt>{row.key}</dt>
          <dd><span className="dot"></span>{row.value}</dd>
        </div>
      ))}
    </dl>
  </div>
);
