import React from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../../shared/ui";

type LoginFormCardProps = {
  username: string;
  password: string;
  error: string | null;
  submitting: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function LoginFormCard({
  username,
  password,
  error,
  submitting,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: LoginFormCardProps) {
  return (
    <div className="login-card">
      <PageHeader
        surface="plain"
        title="AEGIS"
        subtitle="임베디드 펌웨어 보안 분석 작업을 이어갑니다."
      />

      <div className="login-form-section">
        <p className="login-form-heading">등록된 계정으로 계속합니다.</p>

        <form className="login-form" onSubmit={onSubmit}>
          <div className="login-field">
            <label htmlFor="login-username">사용자 이름</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder="name@company.com"
              autoFocus
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">비밀번호</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="login-submit"
            disabled={submitting || !username || !password}
          >
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>

      <div className="login-card__footer-section">
        <p className="login-card__footer">
          계정이 없으신가요?{" "}
          <Link to="/signup" className="login-card__link">회원가입</Link>
        </p>
      </div>
    </div>
  );
}
