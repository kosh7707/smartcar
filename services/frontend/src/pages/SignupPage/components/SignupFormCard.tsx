import React from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../../shared/ui";

type SignupFormCardProps = {
  username: string;
  password: string;
  submitting: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function SignupFormCard({
  username,
  password,
  submitting,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: SignupFormCardProps) {
  return (
    <div className="signup-card">
      <PageHeader
        surface="plain"
        title="AEGIS"
        subtitle="새 계정을 준비하고 분석 워크스페이스로 바로 이동합니다."
      />

      <p className="signup-form-heading">필수 계정 정보를 먼저 입력합니다.</p>

      <form className="signup-form" onSubmit={onSubmit}>
        <div className="signup-field">
          <label htmlFor="signup-fullname">Full name</label>
          <input
            id="signup-fullname"
            type="text"
            placeholder="Enter your full name"
          />
        </div>

        <div className="signup-field">
          <label htmlFor="signup-username">사용자 이름</label>
          <input
            id="signup-username"
            type="text"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="name@company.com"
            autoFocus
            required
          />
        </div>

        <div className="signup-field">
          <label htmlFor="signup-password">비밀번호</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Create a password"
            required
          />
        </div>

        <div className="signup-field">
          <label htmlFor="signup-confirm">Confirm password</label>
          <input
            id="signup-confirm"
            type="password"
            placeholder="Confirm your password"
          />
        </div>

        <button
          type="submit"
          className="signup-submit"
          disabled={submitting || !username || !password}
        >
          {submitting ? "처리 중..." : "계정 만들기"}
        </button>
      </form>

      <div className="signup-divider" />

      <p className="signup-card__footer">
        이미 계정이 있으신가요?{" "}
        <Link to="/login" className="signup-card__link">로그인</Link>
      </p>
    </div>
  );
}
