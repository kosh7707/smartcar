import "./LoginPage.css";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/common/contexts/AuthContext";
import { AuthConsoleShell } from "@/common/ui/auth/AuthConsoleShell";
import { useLoginPageController } from "./useLoginPageController";
import { LoginBrandPanel } from "./components/LoginBrandPanel/LoginBrandPanel";
import { LoginForm } from "./components/LoginForm/LoginForm";

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
    showPassword,
    rememberMe,
    setRememberMe,
    togglePasswordVisibility,
    handleSubmit,
  } = useLoginPageController(login, navigate);

  return (
    <AuthConsoleShell brandPanel={<LoginBrandPanel />}>
      <LoginForm
        username={username}
        password={password}
        error={error}
        submitting={submitting}
        showPassword={showPassword}
        rememberMe={rememberMe}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onRememberMeChange={setRememberMe}
        onPasswordVisibilityToggle={togglePasswordVisibility}
        onSubmit={handleSubmit}
      />
    </AuthConsoleShell>
  );
};
