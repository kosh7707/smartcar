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
        title="프로필 준비"
        subtitle="워크스페이스에 표시할 작업자 정보를 먼저 정리합니다."
      />

      <p className="signup-form-heading">현재 데모 워크스페이스에 사용할 작업자 정보를 입력합니다.</p>

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
          {submitting ? "준비 중..." : "프로필 준비"}
        </button>
      </form>

      <div className="signup-divider" />

      <p className="signup-card__footer">
        이미 입력을 마쳤나요?{" "}
        <Link to="/login" className="signup-card__link">워크스페이스 열기</Link>
      </p>
    </div>
  );
}
