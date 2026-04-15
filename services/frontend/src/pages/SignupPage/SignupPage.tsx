import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { SignupFormCard } from "./components/SignupFormCard";
import { useSignupForm } from "./hooks/useSignupForm";
import "./SignupPage.css";

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const {
    username,
    setUsername,
    password,
    setPassword,
    submitting,
    handleSubmit,
  } = useSignupForm(login, navigate);

  return (
    <div className="signup-page">
      <div className="signup-page__shell">
        <section className="signup-page__hero" aria-label="AEGIS onboarding">
          <div className="signup-page__hero-copy">
            <h1 className="signup-page__eyebrow">AEGIS</h1>
            <p className="signup-page__headline">보안 분석 워크스페이스 준비</p>
            <p className="signup-page__summary">새 계정을 준비하고 분석 워크스페이스로 바로 이동합니다.</p>
            <p className="signup-page__detail">
              프로젝트 운영, 취약점 검토, 승인 흐름을 같은 콘솔에서 이어갈 수 있도록 계정 정보를 먼저 정리합니다.
            </p>
          </div>

          <div className="signup-page__signals" aria-label="AEGIS onboarding signals">
            <span>프로젝트 생성</span>
            <span>분석 파이프라인 준비</span>
            <span>검토·보고 흐름 연결</span>
          </div>
        </section>

        <section className="signup-page__panel">
          <SignupFormCard
            username={username}
            password={password}
            submitting={submitting}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onSubmit={handleSubmit}
          />

          <footer className="signup-page__footer">
            <p>AEGIS v{__APP_VERSION__} — Embedded Firmware Security Analysis Platform</p>
          </footer>
        </section>
      </div>
    </div>
  );
};
