import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { AuthConsoleBrandMark, AuthConsoleFooterMeta, AuthConsoleShell } from "../../shared/auth/AuthConsoleShell";
import { LoginFormCard } from "./components/LoginFormCard";
import { useLoginForm } from "./hooks/useLoginForm";

const loginStatusRows = [
  { key: "API", value: "api.aegis.local · v0.1.0" },
  { key: "Orchestrator", value: "connected · 3 agents live" },
  { key: "Analyzers", value: "SAST · Dynamic · Test queue idle" },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { username, setUsername, password, setPassword, error, submitting, showPassword, rememberMe, setRememberMe, togglePasswordVisibility, handleSubmit } = useLoginForm(login, navigate);

  return (
    <AuthConsoleShell
      brandPanel={(
        <aside className="brand-panel" data-chore>
          <AuthConsoleBrandMark tagline="embedded security · analysis platform" region="kr-seoul-1" statusLabel="operational" />

          <div className="brand-hero">
            <h1 className="chore c-2">임베디드 <em>보안 분석</em>을 한 곳에서</h1>
            <p className="chore c-3">정밀한 소스코드 분석과 시스템 검증으로, 개발 속도를 늦추지 않는 강력한 보안.</p>
            <dl className="status-block chore c-4" id="status-block">
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
      <LoginFormCard
        username={username}
        password={password}
        error={error}
        submitting={submitting}
        showPassword={showPassword}
        rememberMe={rememberMe}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onRememberMeChange={setRememberMe}
        onPasswordVisibilityToggle={togglePasswordVisibility}
        onSubmit={handleSubmit}
      />
    </AuthConsoleShell>
  )
}
