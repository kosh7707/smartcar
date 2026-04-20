import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

type LoginFn = (username: string, password: string) => Promise<unknown>;
type NavigateFn = (to: string) => void;

type OrgVerificationState =
  | { status: "idle" | "checking" | "bad"; statusText: string; name: string; admin: string; region: string; role: string }
  | { status: "ok"; statusText: string; name: string; admin: string; region: string; role: string };

function getInitialOrgVerification(): OrgVerificationState {
  return {
    status: "idle",
    statusText: "awaiting input",
    name: "—",
    admin: "—",
    region: "—",
    role: "승인 시 관리자가 배정",
  };
}

function getPasswordStrengthLevel(password: string): number {
  let level = 0;
  if (password.length >= 8) level += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) level += 1;
  if (/\d/.test(password)) level += 1;
  if (/[^A-Za-z0-9]/.test(password)) level += 1;
  return password.length === 0 ? 0 : level;
}

function getStrengthTicks(level: number): string {
  return ["●○○○", "●○○○", "●●○○", "●●●○", "●●●●"][level] ?? "●○○○";
}

function getStrengthLabel(level: number, password: string): string {
  if (password.length === 0) return "strength=—";
  if (level <= 1) return "strength=weak";
  if (level === 2) return "strength=fair";
  if (level === 3) return "strength=good";
  return "strength=strong";
}

export function useSignupForm(_login: LoginFn, _navigate: NavigateFn) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [orgCode, setOrgCodeState] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [auditAccepted, setAuditAccepted] = useState(false);
  const [orgVerification, setOrgVerification] = useState<OrgVerificationState>(getInitialOrgVerification);

  useEffect(() => {
    document.title = "AEGIS — 가입 요청";
  }, []);

  const strengthLevel = getPasswordStrengthLevel(password);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    setSubmitting(false);
    setSubmitted(true);
  }, []);

  const verifyOrg = useCallback(() => {
    const candidate = orgCode.trim();

    if (!candidate) {
      setOrgVerification(getInitialOrgVerification());
      return;
    }

    setOrgVerification({
      status: "checking",
      statusText: "resolving…",
      name: "—",
      admin: "—",
      region: "—",
      role: "승인 시 관리자가 배정",
    });

    window.setTimeout(() => {
      setOrgVerification({
        status: "ok",
        statusText: "verified · pending approval",
        name: "승인 대기 조직",
        admin: "승인 후 공개",
        region: "internal",
        role: "승인 시 관리자가 배정",
      });
    }, 450);
  }, [orgCode]);

  const setOrgCode = useCallback((value: string) => {
    setOrgCodeState(value);
    setOrgVerification(getInitialOrgVerification());
  }, []);

  return {
    fullName,
    setFullName,
    username,
    setUsername,
    password,
    setPassword,
    submitting,
    submitted,
    setSubmitted,
    showPassword,
    orgCode,
    setOrgCode,
    termsAccepted,
    setTermsAccepted,
    auditAccepted,
    setAuditAccepted,
    orgVerification,
    verifyOrg,
    strengthLevel,
    strengthTicks: getStrengthTicks(strengthLevel),
    strengthLabel: getStrengthLabel(strengthLevel, password),
    togglePasswordVisibility: () => setShowPassword((current) => !current),
    canSubmit: Boolean(fullName && username && password && orgCode && termsAccepted && auditAccepted && !submitted),
    handleSubmit,
  };
}
