import "./LoginForm.css";
import React from "react";
import type { FormEvent } from "react";
import { LoginFormHeader } from "../LoginFormHeader/LoginFormHeader";
import { LoginUsernameField } from "../LoginUsernameField/LoginUsernameField";
import { LoginPasswordField } from "../LoginPasswordField/LoginPasswordField";
import { LoginRememberMeCheckbox } from "../LoginRememberMeCheckbox/LoginRememberMeCheckbox";
import { LoginErrorNotice } from "../LoginErrorNotice/LoginErrorNotice";
import { LoginSubmitButton } from "../LoginSubmitButton/LoginSubmitButton";
import { LoginFinePrint } from "../LoginFinePrint/LoginFinePrint";
import { LoginFormFooter } from "../LoginFormFooter/LoginFormFooter";

interface LoginFormProps {
  username: string;
  password: string;
  error: string | null;
  submitting: boolean;
  showPassword: boolean;
  rememberMe: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (checked: boolean) => void;
  onPasswordVisibilityToggle: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  username,
  password,
  error,
  submitting,
  showPassword,
  rememberMe,
  onUsernameChange,
  onPasswordChange,
  onRememberMeChange,
  onPasswordVisibilityToggle,
  onSubmit,
}) => (
  <div className="form-wrap">
    <LoginFormHeader />

    <form onSubmit={onSubmit} className="auth-form-stack">
      <LoginUsernameField value={username} onChange={onUsernameChange} />
      <LoginPasswordField
        value={password}
        onChange={onPasswordChange}
        showPassword={showPassword}
        onToggleVisibility={onPasswordVisibilityToggle}
      />
      <LoginRememberMeCheckbox checked={rememberMe} onChange={onRememberMeChange} />
      {error ? <LoginErrorNotice message={error} /> : null}
      <LoginSubmitButton submitting={submitting} disabled={!username || !password} />
      <LoginFinePrint />
    </form>

    <LoginFormFooter />
  </div>
);
