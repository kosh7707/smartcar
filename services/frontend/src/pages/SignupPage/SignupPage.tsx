import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { PageHeader } from "../../shared/ui";
import "./SignupPage.css";

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "AEGIS — Sign Up";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Stub: instant login using existing auth logic
      await login(username, password);
      navigate("/projects");
    } catch {
      // Stub: ignore errors, still navigate
      navigate("/projects");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <PageHeader
          surface="plain"
          eyebrow="회원가입"
          title="AEGIS"
          subtitle="새 계정을 준비하고 분석 워크스페이스로 바로 이동합니다."
          icon={<Shield size={18} />}
        />

        {/* Form */}
        <p className="signup-form-heading">필수 계정 정보를 먼저 입력합니다.</p>

        <form className="signup-form" onSubmit={handleSubmit}>
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
              onChange={(e) => setUsername(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
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

      <footer className="signup-page__footer">
        <p>AEGIS v{__APP_VERSION__} — Embedded Firmware Security Analysis Platform</p>
      </footer>
    </div>
  );
};
