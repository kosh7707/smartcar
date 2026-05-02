import "./ResetPasswordForm.css";
import React from "react";
import type { FormEvent } from "react";
import { ResetPasswordPasswordField } from "../ResetPasswordPasswordField/ResetPasswordPasswordField";
import { ResetPasswordConfirmField } from "../ResetPasswordConfirmField/ResetPasswordConfirmField";
import { ResetPasswordErrorNotice } from "../ResetPasswordErrorNotice/ResetPasswordErrorNotice";
import { ResetPasswordSubmitButton } from "../ResetPasswordSubmitButton/ResetPasswordSubmitButton";
import { ResetPasswordFinePrint } from "../ResetPasswordFinePrint/ResetPasswordFinePrint";
import { ResetPasswordFormFooter } from "../ResetPasswordFormFooter/ResetPasswordFormFooter";

interface ResetPasswordFormProps {
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  passwordsMatch: boolean;
  meetsLength: boolean;
  canSubmit: boolean;
  submitting: boolean;
  error: string | null;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  password,
  confirmPassword,
  showPassword,
  passwordsMatch,
  meetsLength,
  canSubmit,
  submitting,
  error,
  onPasswordChange,
  onConfirmPasswordChange,
  onTogglePasswordVisibility,
  onSubmit,
}) => (
  <form onSubmit={onSubmit} className="auth-form-stack">
    <ResetPasswordPasswordField
      value={password}
      onChange={onPasswordChange}
      showPassword={showPassword}
      onToggleVisibility={onTogglePasswordVisibility}
      meetsLength={meetsLength}
    />
    <ResetPasswordConfirmField
      value={confirmPassword}
      onChange={onConfirmPasswordChange}
      showPassword={showPassword}
      passwordsMatch={passwordsMatch}
    />
    {error ? <ResetPasswordErrorNotice message={error} /> : null}
    <ResetPasswordSubmitButton submitting={submitting} disabled={!canSubmit} />
    <ResetPasswordFinePrint />
    <ResetPasswordFormFooter />
  </form>
);
