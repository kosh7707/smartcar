import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Info, Lock } from "lucide-react";
import { AuthConsoleBrandMark, AuthConsoleFooterMeta, AuthConsoleShell } from "../../shared/auth/AuthConsoleShell";
import { useResetPasswordForm } from "./hooks/useResetPasswordForm";

const loginStatusRows = [
  { key: "API", value: "api.aegis.local · v0.1.0" },
  { key: "Orchestrator", value: "connected · 3 agents live" },
  { key: "Analyzers", value: "SAST · Dynamic · Test queue idle" },
];

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    hasToken,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    togglePasswordVisibility,
    passwordsMatch,
    meetsLength,
    canSubmit,
    submitting,
    submitted,
    error,
    handleSubmit,
  } = useResetPasswordForm();

  return (
    <AuthConsoleShell
      onBack={{ label: "로그인으로 돌아가기", onClick: () => navigate("/login") }}
      brandPanel={(
        <aside className="brand-panel" data-chore>
          <AuthConsoleBrandMark tagline="embedded security · analysis platform" region="kr-seoul-1" statusLabel="operational" />

          <div className="brand-hero">
            <h1 className="chore c-2">새 비밀번호<br /><em>설정</em></h1>
            <p className="chore c-3">받은 재설정 링크를 통해 접근했습니다. 안전한 새 비밀번호를 입력해 주세요. 최소 8자, 대·소문자·숫자·특수문자 조합을 권장합니다.</p>
            <dl className="status-block chore c-4">
              {loginStatusRows.map((row) => (
                <div className="row lit" key={row.key}>
                  <dt>{row.key}</dt>
                  <dd><span className="dot"></span>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <AuthConsoleFooterMeta items={[
            { type: "text", label: "© 2026 AEGIS" },
            { type: "link", label: "status" },
            { type: "link", label: "docs" },
            { type: "text", label: `v${__APP_VERSION__} · main` },
          ]} />
        </aside>
      )}
    >
      <div className="form-wrap">
        <div className="form-header chore c-4">
          <span className="eyebrow"><span className="env-dot"></span>AEGIS · PASSWORD RESET</span>
          <h2>새 비밀번호 설정</h2>
          <div className="meta">
            <span>재설정 링크로 접근</span>
            <span className="sep">·</span>
            <span>8자 이상</span>
          </div>
        </div>

        {submitted ? (
          <>
            <div className="notice chore c-5">
              <Info aria-hidden="true" />
              <div>
                <strong>새 비밀번호로 변경되었습니다.</strong><br />
                보안을 위해 기존 세션은 모두 무효화되었습니다. 새 비밀번호로 다시 로그인해 주세요.
              </div>
            </div>
            <div className="form-footer chore c-9">
              <Link to="/login">로그인으로 이동</Link>
            </div>
          </>
        ) : !hasToken ? (
          <>
            <div className="notice chore c-5" role="alert" style={{ borderColor: "var(--danger)", background: "var(--danger-surface)" }}>
              <Info aria-hidden="true" />
              <div>
                <strong>재설정 링크가 유효하지 않습니다.</strong><br />
                링크가 손상되었거나 이미 사용된 링크입니다. 비밀번호 재설정을 다시 요청해 주세요.
              </div>
            </div>
            <div className="form-footer chore c-9">
              <Link to="/forgot-password">비밀번호 재설정 요청</Link>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <div className="field chore c-5">
              <label htmlFor="reset-password">새 비밀번호</label>
              <div className="input-wrap">
                <Lock className="leading" aria-hidden="true" />
                <input
                  id="reset-password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  placeholder="최소 8자 · 대소문자 · 숫자 · 특수문자"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoFocus
                />
                <button type="button" className="trailing-btn" onClick={togglePasswordVisibility} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
              {password.length > 0 && !meetsLength ? (
                <div className="hint" style={{ color: "var(--danger)" }}>최소 8자 이상 입력해 주세요.</div>
              ) : null}
            </div>

            <div className="field chore c-6">
              <label htmlFor="reset-confirm">새 비밀번호 확인</label>
              <div className="input-wrap">
                <Lock className="leading" aria-hidden="true" />
                <input
                  id="reset-confirm"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  placeholder="새 비밀번호 재입력"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
              {confirmPassword.length > 0 && !passwordsMatch ? (
                <div className="hint" style={{ color: "var(--danger)" }}>비밀번호가 일치하지 않습니다.</div>
              ) : null}
            </div>

            {error ? (
              <div className="notice chore c-7" role="alert" style={{ borderColor: "var(--danger)", background: "var(--danger-surface)" }}>
                <Info aria-hidden="true" />
                <div>{error}</div>
              </div>
            ) : null}

            <button className="btn btn-primary btn-block chore c-8" type="submit" disabled={submitting || !canSubmit}>
              {submitting ? "변경 중..." : "새 비밀번호로 설정"}
              {!submitting ? <ArrowRight aria-hidden="true" /> : null}
            </button>

            <p className="fine-print chore c-9">새 비밀번호 설정 후 로그인 페이지로 이동합니다. 기존 세션은 모두 무효화됩니다.</p>

            <div className="form-footer chore c-9">
              재설정을 취소하시나요? <Link to="/login">로그인</Link>
            </div>
          </form>
        )}
      </div>
    </AuthConsoleShell>
  );
};
