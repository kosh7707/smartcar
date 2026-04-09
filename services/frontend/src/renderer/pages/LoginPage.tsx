import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import "./LoginPage.css";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    document.title = "AEGIS — Login";
  }, []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/projects");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "로그인에 실패했습니다.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Branding header */}
        <div className="login-card__header">
          <div className="login-card__icon-wrap">
            <Shield size={28} />
          </div>
          <h1 className="login-card__title">AEGIS</h1>
          <p className="login-card__subtitle">
            Embedded Firmware Security Analysis Platform
          </p>
        </div>

        {/* Form section */}
        <div className="login-form-section">
          <h2 className="login-form-heading">Sign in to AEGIS</h2>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="login-username">사용자 이름</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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

        {/* Footer link section */}
        <div className="login-card__footer-section">
          <p className="login-card__footer">
            계정이 없으신가요?{" "}
            <Link to="/signup" className="login-card__link">회원가입</Link>
          </p>
        </div>
      </div>

      <footer className="login-page__footer">
        <p>AEGIS v{__APP_VERSION__} — Embedded Firmware Security Analysis Platform</p>
      </footer>
    </div>
  );
};
