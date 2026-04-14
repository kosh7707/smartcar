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
    </div>
  );
};
