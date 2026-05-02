import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

type LoginFn = (username: string, password: string, rememberMe?: boolean) => Promise<unknown>;
type NavigateFn = (to: string) => void;

export function useLoginPageController(login: LoginFn, navigate: NavigateFn) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    document.title = "AEGIS — 로그인";
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password, rememberMe);
      navigate("/dashboard");
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : "로그인에 실패했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [login, navigate, password, rememberMe, username]);

  return {
    username,
    setUsername,
    password,
    setPassword,
    error,
    submitting,
    showPassword,
    rememberMe,
    setRememberMe,
    togglePasswordVisibility: () => setShowPassword((current) => !current),
    handleSubmit,
  };
}
