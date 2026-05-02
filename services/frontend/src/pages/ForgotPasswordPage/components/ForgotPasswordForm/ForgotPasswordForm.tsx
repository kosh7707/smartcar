import "./ForgotPasswordForm.css";
import React from "react";
import type { FormEvent } from "react";
import { ForgotPasswordEmailField } from "../ForgotPasswordEmailField/ForgotPasswordEmailField";
import { ForgotPasswordErrorNotice } from "../ForgotPasswordErrorNotice/ForgotPasswordErrorNotice";
import { ForgotPasswordSubmitButton } from "../ForgotPasswordSubmitButton/ForgotPasswordSubmitButton";
import { ForgotPasswordFinePrint } from "../ForgotPasswordFinePrint/ForgotPasswordFinePrint";
import { ForgotPasswordFormFooter } from "../ForgotPasswordFormFooter/ForgotPasswordFormFooter";

interface ForgotPasswordFormProps {
  email: string;
  onEmailChange: (value: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  email,
  onEmailChange,
  submitting,
  error,
  onSubmit,
}) => (
  <form onSubmit={onSubmit} className="auth-form-stack">
    <ForgotPasswordEmailField value={email} onChange={onEmailChange} />
    {error ? <ForgotPasswordErrorNotice message={error} /> : null}
    <ForgotPasswordSubmitButton submitting={submitting} disabled={!email} />
    <ForgotPasswordFinePrint />
    <ForgotPasswordFormFooter />
  </form>
);
