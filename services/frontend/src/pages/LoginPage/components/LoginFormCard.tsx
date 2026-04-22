import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Lock, Mail } from "lucide-react";

type LoginFormCardProps = {
  username: string;
  password: string;
  error: string | null;
  submitting: boolean;
  showPassword: boolean;
  rememberMe: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (checked: boolean) => void;
  onPasswordVisibilityToggle: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function LoginFormCard({
  username,
  password,
  error,
  submitting,
  showPassword,
  rememberMe,
  onUsernameChange,
  onPasswordChange,
  onRememberMeChange,
  onPasswordVisibilityToggle,
  onSubmit,
}: LoginFormCardProps) {
  return (
    <div className="form-wrap">
      <div className="form-header chore c-4">
        <span className="eyebrow"><span className="env-dot"></span>AEGIS · PRODUCTION</span>
        <h2>로그인</h2>
        <div className="meta">
          <span>kr-aegis-01.prod</span>
          <span className="sep">·</span>
          <span>v1.4.2</span>
          <span className="sep">·</span>
          <span>SSO OPTIONAL</span>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div className="field chore c-5">
          <label htmlFor="login-username">이메일</label>
          <div className="input-wrap">
            <Mail className="leading" aria-hidden="true" />
            <input
              id="login-username"
              className="input"
              type="email"
              name="username"
              placeholder="analyst@company.com"
              autoComplete="username"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              required
              autoFocus
            />
          </div>
        </div>

        <div className="field chore c-6">
          <label htmlFor="login-password">
            <span>비밀번호</span>
            <Link to="/forgot-password">잊으셨나요?</Link>
          </label>
          <div className="input-wrap">
            <Lock className="leading" aria-hidden="true" />
            <input
              id="login-password"
              className="input"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              required
            />
            <button type="button" className="trailing-btn" onClick={onPasswordVisibilityToggle} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              {showPassword ? "hide" : "show"}
            </button>
          </div>
        </div>

        <label className="checkbox-row chore c-7">
          <input type="checkbox" checked={rememberMe} onChange={(event) => onRememberMeChange(event.target.checked)} />
          <span className="box"><Check /></span>
          <span>이 기기에서 로그인 유지</span>
        </label>

        {error ? (
          <div className="notice chore c-8" role="alert" style={{ borderColor: "var(--danger)", background: "var(--danger-surface)" }}>
            <AlertCircle aria-hidden="true" />
            <div>{error}</div>
          </div>
        ) : null}

        <button className="btn btn-primary btn-block chore c-8" type="submit" disabled={submitting || !username || !password}>
          {submitting ? "진입 중..." : "로그인"}
          {!submitting ? <ArrowRight aria-hidden="true" /> : null}
        </button>

        <p className="fine-print chore c-9">모든 인증 시도는 <span className="mono">ip · ua · ts</span>와 함께 감사 로그에 기록됩니다.</p>
      </form>

      <div className="form-footer chore c-9">
        계정이 없으신가요? <Link to="/signup">가입 요청</Link>
      </div>
    </div>
  );
}
