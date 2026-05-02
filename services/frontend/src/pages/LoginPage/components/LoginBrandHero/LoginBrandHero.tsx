import "./LoginBrandHero.css";
import React from "react";

interface LoginBrandHeroProps {
  statusRows: ReadonlyArray<{ key: string; value: string }>;
}

export const LoginBrandHero: React.FC<LoginBrandHeroProps> = ({ statusRows }) => (
  <div className="brand-hero">
    <h1 className="chore c-2">임베디드 <em>보안 분석</em>을 한 곳에서</h1>
    <p className="chore c-3">정밀한 소스코드 분석과 시스템 검증으로, 개발 속도를 늦추지 않는 강력한 보안.</p>
    <dl className="status-block chore c-4" id="status-block">
      {statusRows.map((row) => (
        <div className="row lit" key={row.key}>
          <dt>{row.key}</dt>
          <dd><span className="dot"></span>{row.value}</dd>
        </div>
      ))}
    </dl>
  </div>
);
