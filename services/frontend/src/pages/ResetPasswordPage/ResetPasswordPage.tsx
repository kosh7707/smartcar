import "./ResetPasswordPage.css";
import React from "react";
import { useNavigate } from "react-router-dom";
import { AuthConsoleShell } from "@/common/ui/auth/AuthConsoleShell";
import { useResetPasswordPageController } from "./useResetPasswordPageController";
import { ResetPasswordBrandPanel } from "./components/ResetPasswordBrandPanel/ResetPasswordBrandPanel";
import { ResetPasswordFormHeader } from "./components/ResetPasswordFormHeader/ResetPasswordFormHeader";
import { ResetPasswordSubmittedState } from "./components/ResetPasswordSubmittedState/ResetPasswordSubmittedState";
import { ResetPasswordInvalidTokenState } from "./components/ResetPasswordInvalidTokenState/ResetPasswordInvalidTokenState";
import { ResetPasswordForm } from "./components/ResetPasswordForm/ResetPasswordForm";

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    hasToken,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    togglePasswordVisibility,
    passwordsMatch,
    meetsLength,
    canSubmit,
    submitting,
    submitted,
    error,
    handleSubmit,
  } = useResetPasswordPageController();

  return (
    <AuthConsoleShell
      onBack={{ label: "로그인으로 돌아가기", onClick: () => navigate("/login") }}
      brandPanel={<ResetPasswordBrandPanel />}
    >
      <div className="form-wrap">
        <ResetPasswordFormHeader />
        {submitted ? (
          <ResetPasswordSubmittedState />
        ) : !hasToken ? (
          <ResetPasswordInvalidTokenState />
        ) : (
          <ResetPasswordForm
            password={password}
            confirmPassword={confirmPassword}
            showPassword={showPassword}
            passwordsMatch={passwordsMatch}
            meetsLength={meetsLength}
            canSubmit={canSubmit}
            submitting={submitting}
            error={error}
            onPasswordChange={setPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onTogglePasswordVisibility={togglePasswordVisibility}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </AuthConsoleShell>
  );
};
