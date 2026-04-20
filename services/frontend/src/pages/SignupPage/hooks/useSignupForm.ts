import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { OrganizationVerifyPreview, RegistrationRequestStatus } from "@aegis/shared";
import { register as registerApi, verifyOrgCode } from "../../../api/auth";

type LoginFn = (username: string, password: string, rememberMe?: boolean) => Promise<unknown>;
type NavigateFn = (to: string) => void;

type OrgVerificationState = {
  status: "idle" | "checking" | "ok" | "bad";
  statusText: string;
  name: string;
  admin: string;
  region: string;
  role: string;
};

type SubmittedReceipt = {
  registrationId: string;
  lookupToken: string;
  lookupExpiresAt: string;
  status: RegistrationRequestStatus;
  createdAt: string;
};

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

function formatDefaultRole(role: OrganizationVerifyPreview["defaultRole"]): string {
  switch (role) {
    case "admin":
      return "admin (관리자)";
    case "analyst":
      return "analyst (분석가)";
    case "viewer":
      return "viewer (열람자)";
    default:
      return role;
  }
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmittedReceipt | null>(null);

  useEffect(() => {
    document.title = "AEGIS — 가입 요청";
  }, []);

  const strengthLevel = getPasswordStrengthLevel(password);

  const verifyOrg = useCallback(async () => {
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

    try {
      const preview = await verifyOrgCode(candidate);
      setOrgVerification({
        status: "ok",
        statusText: "verified · pending approval",
        name: preview.name,
        admin: preview.admin.displayName
          ? `${preview.admin.displayName} · ${preview.admin.email}`
          : preview.admin.email,
        region: preview.region,
        role: formatDefaultRole(preview.defaultRole),
      });
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : "조직 코드를 확인할 수 없습니다.";
      setOrgVerification({
        status: "bad",
        statusText: message,
        name: "—",
        admin: "—",
        region: "—",
        role: "승인 시 관리자가 배정",
      });
    }
  }, [orgCode]);

  const setOrgCode = useCallback((value: string) => {
    setOrgCodeState(value);
    setOrgVerification(getInitialOrgVerification());
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || submitted) return;

    setSubmitError(null);
    setSubmitting(true);
    const now = new Date().toISOString();
    try {
      const data = await registerApi({
        fullName: fullName.trim(),
        email: username.trim(),
        password,
        orgCode: orgCode.trim(),
        termsAcceptedAt: now,
        auditAcceptedAt: now,
      });
      setReceipt({
        registrationId: data.registrationId,
        lookupToken: data.lookupToken,
        lookupExpiresAt: data.lookupExpiresAt,
        status: data.status,
        createdAt: data.createdAt,
      });
      setSubmitted(true);
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : "가입 요청을 제출하지 못했습니다.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }, [fullName, orgCode, password, submitted, submitting, username]);

  return {
    fullName,
    setFullName,
    username,
    setUsername,
    password,
    setPassword,
    submitting,
    submitted,
    setSubmitted: (value: boolean) => {
      setSubmitted(value);
      if (!value) {
        setReceipt(null);
        setSubmitError(null);
      }
    },
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
    canSubmit: Boolean(
      fullName
      && username
      && password
      && orgCode
      && termsAccepted
      && auditAccepted
      && orgVerification.status === "ok"
      && !submitted,
    ),
    handleSubmit,
    submitError,
    receipt,
  };
}
