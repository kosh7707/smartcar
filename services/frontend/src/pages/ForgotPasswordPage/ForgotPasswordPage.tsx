import "./ForgotPasswordPage.css";
import React from "react";
import { useNavigate } from "react-router-dom";
import { AuthConsoleShell } from "@/common/ui/auth/AuthConsoleShell";
import { useForgotPasswordPageController } from "./useForgotPasswordPageController";
import { ForgotPasswordBrandPanel } from "./components/ForgotPasswordBrandPanel/ForgotPasswordBrandPanel";
import { ForgotPasswordFormHeader } from "./components/ForgotPasswordFormHeader/ForgotPasswordFormHeader";
import { ForgotPasswordForm } from "./components/ForgotPasswordForm/ForgotPasswordForm";
import { ForgotPasswordSuccessState } from "./components/ForgotPasswordSuccessState/ForgotPasswordSuccessState";

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { email, setEmail, submitting, submitted, error, handleSubmit, reset } = useForgotPasswordPageController();

  return (
    <AuthConsoleShell
      onBack={{ label: "로그인으로 돌아가기", onClick: () => navigate("/login") }}
      brandPanel={<ForgotPasswordBrandPanel />}
    >
      <div className="form-wrap">
        <ForgotPasswordFormHeader />
        {submitted ? (
          <ForgotPasswordSuccessState email={email} onReset={reset} />
        ) : (
          <ForgotPasswordForm
            email={email}
            onEmailChange={setEmail}
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </AuthConsoleShell>
  );
};
