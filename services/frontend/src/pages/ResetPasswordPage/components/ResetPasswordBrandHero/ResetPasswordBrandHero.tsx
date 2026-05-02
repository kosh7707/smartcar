import "./ResetPasswordBrandHero.css";
import React from "react";

interface ResetPasswordBrandHeroProps {
  statusRows: ReadonlyArray<{ key: string; value: string }>;
}

export const ResetPasswordBrandHero: React.FC<ResetPasswordBrandHeroProps> = ({ statusRows }) => (
  <div className="brand-hero">
    <h1 className="chore c-2">새 비밀번호<br /><em>설정</em></h1>
    <p className="chore c-3">받은 재설정 링크를 통해 접근했습니다. 안전한 새 비밀번호를 입력해 주세요. 최소 8자, 대·소문자·숫자·특수문자 조합을 권장합니다.</p>
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
