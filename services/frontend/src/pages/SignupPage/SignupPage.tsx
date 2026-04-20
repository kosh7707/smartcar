import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { AuthConsoleBrandMark, AuthConsoleFooterMeta, AuthConsoleShell } from "../../shared/auth/AuthConsoleShell";
import { SignupFormCard } from "./components/SignupFormCard";
import { useSignupForm } from "./hooks/useSignupForm";

const onboardingSteps = [
  { label: "가입 요청 제출", detail: "이메일, 비밀번호, 조직 코드를 오른쪽 폼에 입력하세요.", current: true },
  { label: "조직 관리자 검토 · 승인", detail: "요청은 승인 큐에 등록됩니다. 평균 응답 시간 < 24h." },
  { label: "가입 시 입력한 계정으로 로그인", detail: "승인 즉시 최초 로그인 가능. 별도 초대 링크는 없습니다." },
  { label: "콘솔 진입 · 프로젝트 배정", detail: "배정된 프로젝트와 권한 스코프가 대시보드에 나타납니다." },
]

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const {
    fullName,
    setFullName,
    username,
    setUsername,
    password,
    setPassword,
    submitting,
    showPassword,
    submitted,
    setSubmitted,
    orgCode,
    setOrgCode,
    termsAccepted,
    setTermsAccepted,
    auditAccepted,
    setAuditAccepted,
    orgVerification,
    verifyOrg,
    strengthLevel,
    strengthTicks,
    strengthLabel,
    togglePasswordVisibility,
    canSubmit,
    handleSubmit,
    submitError,
    receipt,
  } = useSignupForm(login, navigate)

  return (
    <AuthConsoleShell
      onBack={{ label: "로그인으로 돌아가기", onClick: () => navigate("/login") }}
      brandPanel={(
        <aside className="brand-panel" data-chore>
          <AuthConsoleBrandMark tagline="embedded security · analysis platform" region="kr-seoul-1" statusLabel="operational" />

          <div className="brand-hero">
            <h1 className="chore c-2">계정 하나로<br /><em>분석부터 승인까지.</em></h1>
            <p className="chore c-3">정밀한 소스코드 분석과 시스템 검증으로, 개발 속도를 늦추지 않는 강력한 보안.</p>
            <div className="onboard-header chore c-4">
              <span className="label">onboarding · request flow</span>
              <span className="counter">step <span className="cur">01</span> / 04</span>
            </div>
            <div className="onboard-list chore c-4">
              {onboardingSteps.map((step, index) => (
                <div className={`onboard-item ${step.current ? 'current' : 'upcoming'}`} key={step.label}>
                  <div className="step">{step.current ? '' : index + 1}</div>
                  <div className="body">
                    <div className="title-row">
                      <span className="title">{step.label}</span>
                      {step.current ? <span className="now-tag">NOW</span> : null}
                    </div>
                    <div className="desc">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AuthConsoleFooterMeta items={[
            { type: "text", label: "© 2026 AEGIS" },
            { type: "link", label: "security" },
            { type: "link", label: "privacy" },
            { type: "text", label: `v${__APP_VERSION__} · main` },
          ]} />
        </aside>
      )}
    >
      <SignupFormCard
        fullName={fullName}
        username={username}
        password={password}
        submitting={submitting}
        submitted={submitted}
        showPassword={showPassword}
        orgCode={orgCode}
        termsAccepted={termsAccepted}
        auditAccepted={auditAccepted}
        orgVerification={orgVerification}
        strengthLevel={strengthLevel}
        strengthTicks={strengthTicks}
        strengthLabel={strengthLabel}
        canSubmit={canSubmit}
        onFullNameChange={setFullName}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onPasswordVisibilityToggle={togglePasswordVisibility}
        onOrgCodeChange={setOrgCode}
        onVerifyOrg={verifyOrg}
        onTermsAcceptedChange={setTermsAccepted}
        onAuditAcceptedChange={setAuditAccepted}
        onResetSubmitted={() => setSubmitted(false)}
        onSubmit={handleSubmit}
        submitError={submitError}
        receipt={receipt}
      />
    </AuthConsoleShell>
  )
}
