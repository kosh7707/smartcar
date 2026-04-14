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
    </div>
  );
};
