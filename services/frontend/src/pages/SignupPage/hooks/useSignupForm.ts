import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

type LoginFn = (username: string, password: string) => Promise<unknown>;
type NavigateFn = (to: string) => void;

export function useSignupForm(login: LoginFn, navigate: NavigateFn) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "AEGIS — Sign Up";
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch {
      navigate("/dashboard");
    } finally {
      setSubmitting(false);
    }
  }, [login, navigate, password, username]);

  return {
    username,
    setUsername,
    password,
    setPassword,
    submitting,
    handleSubmit,
  };
}
