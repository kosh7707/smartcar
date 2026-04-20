import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { confirmPasswordReset } from "../../../api/auth";
import type { User } from "@aegis/shared";

type SetUserFn = (user: User | null) => void;

export function useResetPasswordForm(onAuthenticated?: SetUserFn) {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token") ?? "";
  }, [location.search]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "AEGIS — 새 비밀번호 설정";
  }, []);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const meetsLength = password.length >= 8;
  const canSubmit = Boolean(token) && passwordsMatch && meetsLength;

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await confirmPasswordReset(token, password);
      onAuthenticated?.(user);
      navigate("/dashboard");
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : "재설정 링크가 유효하지 않거나 만료되었습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, navigate, onAuthenticated, password, token]);

  return {
    token,
    hasToken: Boolean(token),
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    togglePasswordVisibility: () => setShowPassword((current) => !current),
    passwordsMatch,
    meetsLength,
    canSubmit,
    submitting,
    error,
    handleSubmit,
  };
}
