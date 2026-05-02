import "./SignupForm.css";
import React from "react";
import type { FormEvent } from "react";
import { SignupRequestNotice } from "../SignupRequestNotice/SignupRequestNotice";
import { SignupAccountSection } from "../SignupAccountSection/SignupAccountSection";
import { SignupOrganizationSection } from "../SignupOrganizationSection/SignupOrganizationSection";
import { SignupConsentChecks } from "../SignupConsentChecks/SignupConsentChecks";
import { SignupErrorNotice } from "../SignupErrorNotice/SignupErrorNotice";
import { SignupSubmitButton } from "../SignupSubmitButton/SignupSubmitButton";

interface OrgVerificationState {
  status: "idle" | "checking" | "ok" | "bad";
  statusText: string;
  name: string;
  admin: string;
  region: string;
  role: string;
}

interface SignupFormProps {
  fullName: string;
  username: string;
  password: string;
  showPassword: boolean;
  orgCode: string;
  termsAccepted: boolean;
  auditAccepted: boolean;
  orgVerification: OrgVerificationState;
  strengthLevel: number;
  strengthTicks: string;
  strengthLabel: string;
  submitting: boolean;
  canSubmit: boolean;
  submitError: string | null;
  onFullNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordVisibilityToggle: () => void;
  onOrgCodeChange: (value: string) => void;
  onVerifyOrg: () => void;
  onTermsAcceptedChange: (checked: boolean) => void;
  onAuditAcceptedChange: (checked: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({
  fullName,
  username,
  password,
  showPassword,
  orgCode,
  termsAccepted,
  auditAccepted,
  orgVerification,
  strengthLevel,
  strengthTicks,
  strengthLabel,
  submitting,
  canSubmit,
  submitError,
  onFullNameChange,
  onUsernameChange,
  onPasswordChange,
  onPasswordVisibilityToggle,
  onOrgCodeChange,
  onVerifyOrg,
  onTermsAcceptedChange,
  onAuditAcceptedChange,
  onSubmit,
}) => (
  <>
    <SignupRequestNotice />
    <form onSubmit={onSubmit} className="signup-form-stack">
      <SignupAccountSection
        fullName={fullName}
        username={username}
        password={password}
        showPassword={showPassword}
        strengthLevel={strengthLevel}
        strengthTicks={strengthTicks}
        strengthLabel={strengthLabel}
        onFullNameChange={onFullNameChange}
        onUsernameChange={onUsernameChange}
        onPasswordChange={onPasswordChange}
        onPasswordVisibilityToggle={onPasswordVisibilityToggle}
      />
      <SignupOrganizationSection
        orgCode={orgCode}
        verification={orgVerification}
        onOrgCodeChange={onOrgCodeChange}
        onVerifyOrg={onVerifyOrg}
      />
      <SignupConsentChecks
        termsAccepted={termsAccepted}
        auditAccepted={auditAccepted}
        onTermsAcceptedChange={onTermsAcceptedChange}
        onAuditAcceptedChange={onAuditAcceptedChange}
      />
      {submitError ? <SignupErrorNotice message={submitError} /> : null}
      <SignupSubmitButton submitting={submitting} disabled={!canSubmit} />
    </form>
  </>
);
