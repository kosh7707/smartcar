import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Building2, Check, Eye, EyeOff, Info, Lock, Mail, User } from "lucide-react";

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
  status: "pending_admin_review" | "approved" | "rejected";
  createdAt: string;
};

type SignupFormCardProps = {
  fullName: string;
  username: string;
  password: string;
  submitting: boolean;
  submitted: boolean;
  showPassword: boolean;
  orgCode: string;
  termsAccepted: boolean;
  auditAccepted: boolean;
  orgVerification: OrgVerificationState;
  strengthLevel: number;
  strengthTicks: string;
  strengthLabel: string;
  canSubmit: boolean;
  submitError: string | null;
  receipt: SubmittedReceipt | null;
  onFullNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordVisibilityToggle: () => void;
  onOrgCodeChange: (value: string) => void;
  onVerifyOrg: () => void;
  onTermsAcceptedChange: (checked: boolean) => void;
  onAuditAcceptedChange: (checked: boolean) => void;
  onResetSubmitted: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function formatLookupExpires(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SignupFormCard({
  fullName,
  username,
  password,
  submitting,
  submitted,
  showPassword,
  orgCode,
  termsAccepted,
  auditAccepted,
  orgVerification,
  strengthLevel,
  strengthTicks,
  strengthLabel,
  canSubmit,
  submitError,
  receipt,
  onFullNameChange,
  onUsernameChange,
  onPasswordChange,
  onPasswordVisibilityToggle,
  onOrgCodeChange,
  onVerifyOrg,
  onTermsAcceptedChange,
  onAuditAcceptedChange,
  onResetSubmitted,
  onSubmit,
}: SignupFormCardProps) {
  return (
    <div className="form-wrap">
      <div className="form-header chore c-4">
        <span className="eyebrow"><span className="env-dot"></span>AEGIS · ACCESS REQUEST</span>
        <h2>회원가입</h2>
        <div className="meta">
          <span>관리자 승인 필요</span>
          <span className="sep">·</span>
          <span>ETA ~1 영업일</span>
          <span className="sep">·</span>
          <span>kr-aegis-01.prod</span>
        </div>
      </div>

      {submitted ? (
        <>
          <div className="notice chore c-5">
            <Info aria-hidden="true" />
            <div>
              <strong>가입 요청이 제출되었습니다.</strong><br />
              조직 관리자의 승인을 기다리세요. 승인 후에는 이 페이지에서 입력한 이메일과 비밀번호로 바로 로그인하실 수 있습니다.
            </div>
          </div>
          <div className="org-verify" data-state="ok">
            <div className="status"><span className="dot"></span><span>request submitted · awaiting approval</span></div>
            <div className="row"><span className="k">이름</span><span className="v">{fullName || "—"}</span></div>
            <div className="row"><span className="k">이메일</span><span className="v mono">{username || "—"}</span></div>
            <div className="row"><span className="k">조직 코드</span><span className="v mono">{orgCode || "—"}</span></div>
            {receipt ? (
              <>
                <div className="row"><span className="k">요청 ID</span><span className="v mono">{receipt.registrationId}</span></div>
                <div className="row"><span className="k">조회 토큰</span><span className="v mono">{receipt.lookupToken}</span></div>
                <div className="row"><span className="k">토큰 만료</span><span className="v mono">{formatLookupExpires(receipt.lookupExpiresAt)}</span></div>
              </>
            ) : null}
          </div>
          <div className="form-footer chore c-9">
            이미 계정이 있으신가요? <Link to="/login">로그인</Link>
          </div>
          <button className="btn btn-ghost btn-block chore c-9" type="button" onClick={onResetSubmitted}>다시 요청 작성</button>
        </>
      ) : (
        <>
          <div className="notice chore c-5">
            <Info aria-hidden="true" />
            <div>
              <strong>가입은 승인제로 운영됩니다.</strong><br />
              조직 코드를 입력하고 검증한 뒤, 가입 요청을 제출하세요. 승인은 조직 관리자가 처리합니다.
            </div>
          </div>

          <form onSubmit={onSubmit} className="signup-form-stack">
            <div className="section-group chore c-6">
              <div className="rail">
                <div className="num">01</div>
                <div className="line"></div>
              </div>
              <div className="body">
                <div className="section-header">
                  <span className="title">계정 정보</span>
                </div>

                <div className="field">
                  <label htmlFor="signup-fullname">이름</label>
                  <div className="input-wrap">
                    <User className="leading" aria-hidden="true" />
                    <input id="signup-fullname" className="input" type="text" placeholder="홍길동" autoComplete="name" value={fullName} onChange={(event) => onFullNameChange(event.target.value)} required />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="signup-username">업무용 이메일</label>
                  <div className="input-wrap">
                    <Mail className="leading" aria-hidden="true" />
                    <input id="signup-username" className="input" type="email" placeholder="analyst@company.com" autoComplete="email" value={username} onChange={(event) => onUsernameChange(event.target.value)} required />
                  </div>
                  <div className="hint">개인 이메일은 승인되지 않을 수 있습니다.</div>
                </div>

                <div className="field">
                  <label htmlFor="signup-password">비밀번호</label>
                  <div className="input-wrap">
                    <Lock className="leading" aria-hidden="true" />
                    <input id="signup-password" className="input" type={showPassword ? "text" : "password"} placeholder="최소 8자 · 대소문자 · 숫자 · 특수문자" autoComplete="new-password" value={password} onChange={(event) => onPasswordChange(event.target.value)} required />
                    <button type="button" className="trailing-btn" onClick={onPasswordVisibilityToggle} aria-label={showPassword ? "가입 비밀번호 숨기기" : "가입 비밀번호 보기"}>
                      {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                  </div>
                  <div className="strength" data-level={strengthLevel}>
                    <div className="strength-ticks">{strengthTicks}</div>
                    <div className="strength-label">{strengthLabel}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`section-group chore c-8 ${orgVerification.status !== "idle" ? "active" : ""}`} id="org-section">
              <div className="rail"><div className="num">02</div></div>
              <div className="body">
                <div className="section-header">
                  <span className="title">조직 · 접근 범위</span>
                </div>

                <div className="field">
                  <label htmlFor="signup-org-code">
                    <span>조직 코드</span>
                    <span className="label-caps">CASE-SENSITIVE</span>
                  </label>
                  <div className="input-wrap">
                    <Building2 className="leading" aria-hidden="true" />
                    <input id="signup-org-code" className="input signup-org-input" type="text" placeholder="ACME-KR-SEC" autoComplete="off" value={orgCode} onChange={(event) => onOrgCodeChange(event.target.value)} required />
                    <button id="org-verify-btn" data-state={orgVerification.status} type="button" className="trailing-btn" onClick={onVerifyOrg} aria-label="조직 코드 검증">verify</button>
                  </div>
                </div>

                <div className="org-verify" data-state={orgVerification.status}>
                  <div className="status"><span className="dot"></span><span>{orgVerification.statusText}</span></div>
                  <div className="row"><span className="k">조직명</span><span className="v">{orgVerification.name}</span></div>
                  <div className="row"><span className="k">관리자</span><span className="v mono">{orgVerification.admin}</span></div>
                  <div className="row"><span className="k">리전</span><span className="v mono">{orgVerification.region}</span></div>
                  <div className="row"><span className="k">배정 역할</span><span className="v">{orgVerification.role}</span></div>
                </div>

              </div>
            </div>

            <div className="chore c-9 signup-consent-stack">
              <label className="checkbox-row">
                <input type="checkbox" checked={termsAccepted} onChange={(event) => onTermsAcceptedChange(event.target.checked)} />
                <span className="box"><Check /></span>
                <span><button type="button" onClick={(event) => event.preventDefault()}>서비스 이용 약관</button>과 <button type="button" onClick={(event) => event.preventDefault()}>개인정보 처리방침</button>에 동의합니다. <span className="signup-required-marker">*</span></span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={auditAccepted} onChange={(event) => onAuditAcceptedChange(event.target.checked)} />
                <span className="box"><Check /></span>
                <span>계정 활동은 감사 목적으로 기록되며, 조직 관리자가 열람할 수 있음을 이해합니다. <span className="signup-required-marker">*</span></span>
              </label>
            </div>

            {submitError ? (
              <div className="notice notice--danger chore c-9" role="alert">
                <AlertCircle aria-hidden="true" />
                <div>{submitError}</div>
              </div>
            ) : null}

            <button className="btn btn-primary btn-block chore c-9" type="submit" disabled={submitting || !canSubmit}>
              {submitting ? '요청 제출 중...' : '가입 요청 제출'}
              {!submitting ? <ArrowRight aria-hidden="true" /> : null}
            </button>
          </form>

          <div className="form-footer chore c-9">이미 계정이 있으신가요? <Link to="/login">로그인</Link></div>
        </>
      )}
    </div>
  )
}
