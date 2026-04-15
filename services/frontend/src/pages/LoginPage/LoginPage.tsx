import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { LoginFormCard } from "./components/LoginFormCard";
import { useLoginForm } from "./hooks/useLoginForm";
import "./LoginPage.css";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const {
    username,
    setUsername,
    password,
    setPassword,
    error,
    submitting,
    handleSubmit,
  } = useLoginForm(login, navigate);

  return (
    <div className="login-page">
      <div className="login-page__shell">
        <section className="login-page__hero" aria-label="AEGIS introduction">
          <div className="login-page__hero-copy">
            <h1 className="login-page__eyebrow">AEGIS</h1>
            <p className="login-page__headline">임베디드 펌웨어 보안 운영 콘솔</p>
            <p className="login-page__summary">임베디드 펌웨어 보안 분석 작업을 이어갑니다.</p>
            <p className="login-page__detail">
              분석 실행, 승인 대기, 게이트 상태를 같은 작업 리듬 안에서 이어갈 수 있도록 설계된 운영형 워크스페이스입니다.
            </p>
          </div>

          <div className="login-page__signals" aria-label="AEGIS workflow signals">
            <span>정적 · 동적 분석</span>
            <span>Quality Gate &amp; Approval</span>
            <span>Firmware Security Trace</span>
          </div>
        </section>

        <section className="login-page__panel">
          <LoginFormCard
            username={username}
            password={password}
            error={error}
            submitting={submitting}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onSubmit={handleSubmit}
          />

          <footer className="login-page__footer">
            <p>AEGIS v{__APP_VERSION__} — Embedded Firmware Security Analysis Platform</p>
          </footer>
        </section>
      </div>
    </div>
  );
};
