import "./SignupPage.css";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/common/contexts/AuthContext";
import { AuthConsoleShell } from "@/common/ui/auth/AuthConsoleShell";
import { useSignupPageController } from "./useSignupPageController";
import { SignupBrandPanel } from "./components/SignupBrandPanel/SignupBrandPanel";
import { SignupFormHeader } from "./components/SignupFormHeader/SignupFormHeader";
import { SignupForm } from "./components/SignupForm/SignupForm";
import { SignupFormFooter } from "./components/SignupFormFooter/SignupFormFooter";
import { SignupSubmittedState } from "./components/SignupSubmittedState/SignupSubmittedState";

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const state = useSignupPageController(login, navigate);

  return (
    <AuthConsoleShell
      onBack={{ label: "로그인으로 돌아가기", onClick: () => navigate("/login") }}
      brandPanel={<SignupBrandPanel />}
    >
      <div className="form-wrap">
        <SignupFormHeader />
        {state.submitted ? (
          <SignupSubmittedState
            fullName={state.fullName}
            username={state.username}
            orgCode={state.orgCode}
            receipt={state.receipt}
            onReset={() => state.setSubmitted(false)}
          />
        ) : (
          <>
            <SignupForm
              fullName={state.fullName}
              username={state.username}
              password={state.password}
              showPassword={state.showPassword}
              orgCode={state.orgCode}
              termsAccepted={state.termsAccepted}
              auditAccepted={state.auditAccepted}
              orgVerification={state.orgVerification}
              strengthLevel={state.strengthLevel}
              strengthTicks={state.strengthTicks}
              strengthLabel={state.strengthLabel}
              submitting={state.submitting}
              canSubmit={state.canSubmit}
              submitError={state.submitError}
              onFullNameChange={state.setFullName}
              onUsernameChange={state.setUsername}
              onPasswordChange={state.setPassword}
              onPasswordVisibilityToggle={state.togglePasswordVisibility}
              onOrgCodeChange={state.setOrgCode}
              onVerifyOrg={state.verifyOrg}
              onTermsAcceptedChange={state.setTermsAccepted}
              onAuditAcceptedChange={state.setAuditAccepted}
              onSubmit={state.handleSubmit}
            />
            <SignupFormFooter />
          </>
        )}
      </div>
    </AuthConsoleShell>
  );
};
