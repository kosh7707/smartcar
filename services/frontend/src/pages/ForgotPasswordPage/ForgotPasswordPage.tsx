import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Info, Mail } from "lucide-react";
import { AuthConsoleBrandMark, AuthConsoleFooterMeta, AuthConsoleShell } from "../../shared/auth/AuthConsoleShell";
import { useForgotPasswordForm } from "./hooks/useForgotPasswordForm";
import { useNavigate } from "react-router-dom";

const loginStatusRows = [
  { key: "API", value: "api.aegis.local · v0.1.0" },
  { key: "Orchestrator", value: "connected · 3 agents live" },
  { key: "Analyzers", value: "SAST · Dynamic · Test queue idle" },
];

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { email, setEmail, submitting, submitted, error, handleSubmit, reset } = useForgotPasswordForm();

  return (
    <AuthConsoleShell
      onBack={{ label: "로그인으로 돌아가기", onClick: () => navigate("/login") }}
      brandPanel={(
        <aside className="brand-panel" data-chore>
          <AuthConsoleBrandMark tagline="embedded security · analysis platform" region="kr-seoul-1" statusLabel="operational" />

          <div className="brand-hero">
            <h1 className="chore c-2">비밀번호를 <em>잊으셨나요?</em></h1>
            <p className="chore c-3">가입하신 업무용 이메일로 재설정 링크를 보내드립니다. 받은 링크에서 새 비밀번호를 설정해 주세요.</p>
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
          <h2>비밀번호 재설정</h2>
          <div className="meta">
            <span>이메일로 링크 발송</span>
            <span className="sep">·</span>
            <span>링크 만료 1시간</span>
          </div>
        </div>

        {submitted ? (
          <>
            <div className="notice chore c-5">
              <Info aria-hidden="true" />
              <div>
                <strong>재설정 링크를 발송했습니다.</strong><br />
                {email || "입력하신 이메일"}로 받은 메일의 링크를 클릭해 새 비밀번호를 설정하세요. 메일이 도착하지 않으면 스팸함을 확인하거나 1시간 뒤 다시 시도해 주세요.
              </div>
            </div>
            <div className="form-footer chore c-9">
              <Link to="/login">로그인으로 돌아가기</Link>
            </div>
            <button className="btn btn-ghost btn-block chore c-9" type="button" onClick={reset}>다른 이메일로 다시 요청</button>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <div className="field chore c-5">
              <label htmlFor="forgot-email">이메일</label>
              <div className="input-wrap">
                <Mail className="leading" aria-hidden="true" />
                <input
                  id="forgot-email"
                  className="input"
                  type="email"
                  placeholder="analyst@company.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="hint">가입 시 입력한 업무용 이메일을 사용해 주세요.</div>
            </div>

            {error ? (
              <div className="notice chore c-6" role="alert" style={{ borderColor: "var(--danger)", background: "var(--danger-surface)" }}>
                <Info aria-hidden="true" />
                <div>{error}</div>
              </div>
            ) : null}

            <button className="btn btn-primary btn-block chore c-7" type="submit" disabled={submitting || !email}>
              {submitting ? "발송 중..." : "재설정 링크 발송"}
              {!submitting ? <ArrowRight aria-hidden="true" /> : null}
            </button>

            <p className="fine-print chore c-8">보안을 위해 가입된 이메일 여부는 별도로 알리지 않습니다.</p>

            <div className="form-footer chore c-9">
              비밀번호가 기억나셨나요? <Link to="/login">로그인</Link>
            </div>
          </form>
        )}
      </div>
    </AuthConsoleShell>
  );
};
