import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { requestPasswordReset } from "@/common/api/auth";

export function useForgotPasswordPageController() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "AEGIS — 비밀번호 재설정";
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [email]);

  return {
    email,
    setEmail,
    submitting,
    submitted,
    error,
    handleSubmit,
    reset: () => {
      setSubmitted(false);
      setError(null);
    },
  };
}
