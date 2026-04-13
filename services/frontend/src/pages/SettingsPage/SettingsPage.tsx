import React, { useState, useEffect } from "react";
import { Settings, Server, Info, Check, X, Sun, Moon, Monitor } from "lucide-react";
import { getBackendUrl, setBackendUrl, healthFetch } from "../../api/client";
import { getThemePreference, setThemePreference, type ThemePreference } from "../../utils/theme";
import { PageHeader, Spinner } from "../../shared/ui";
import "./SettingsPage.css";

type TestStatus = "idle" | "testing" | "ok" | "error";

export const SettingsPage: React.FC = () => {
  const [url, setUrl] = useState(getBackendUrl);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testDetail, setTestDetail] = useState("");
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);

  useEffect(() => {
    document.title = "AEGIS — Settings";
  }, []);

  const handleThemeChange = (pref: ThemePreference) => {
    setTheme(pref);
    setThemePreference(pref);
  };

  const handleSave = () => {
    setBackendUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setBackendUrl("");
    setUrl(getBackendUrl());
    setTestStatus("idle");
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTestDetail("");
    const { ok, data } = await healthFetch(url.trim());
    if (ok && data) {
      setTestStatus("ok");
      setTestDetail(`${data.service ?? "backend"} ${data.version ?? ""}`.trim());
    } else {
      setTestStatus("error");
      setTestDetail(ok ? "비정상 응답" : "연결 실패");
    }
  };

  const urlDirty = url !== getBackendUrl();

  return (
    <div className="page-enter">
      <PageHeader
        surface="plain"
        eyebrow="시스템 설정"
        title="System Settings"
        subtitle="Global core configuration and environment parameters."
        action={(
          <div className="gs-page-header__actions">
            <button className="btn btn-secondary" onClick={handleReset}>Reset</button>
            <button className="btn" onClick={handleSave} disabled={!urlDirty && !saved}>
              {saved ? "저장됨" : "Save Changes"}
            </button>
          </div>
        )}
      />

      {/* Bento grid */}
      <div className="gs-bento">

        {/* Platform Information */}
        <div className="card gs-section gs-bento__col-4">
          <div className="gs-section__header">
            <div className="gs-section__icon"><Info size={20} /></div>
            <h3 className="gs-section__title">Platform Information</h3>
          </div>
          <div className="gs-info-table">
            <div className="gs-info-row">
              <span className="gs-info-label">Platform</span>
              <span className="gs-info-value">AEGIS</span>
            </div>
            <div className="gs-info-row">
              <span className="gs-info-label">Version</span>
              <span className="gs-info-value gs-info-value--mono"><code>v{__APP_VERSION__}</code></span>
            </div>
            <div className="gs-info-row">
              <span className="gs-info-label">License</span>
              <span className="gs-info-value gs-info-value--accent">Enterprise</span>
            </div>
            <div className="gs-info-row">
              <span className="gs-info-label">Framework</span>
              <span className="gs-info-value">AEGIS</span>
            </div>
          </div>
        </div>

        {/* Backend Server */}
        <div className="card gs-section gs-bento__col-8">
          <div className="gs-section__header">
            <div className="gs-section__icon"><Server size={20} /></div>
            <h3 className="gs-section__title">Backend Server</h3>
          </div>
          <div className="gs-info-row" style={{ marginBottom: "var(--cds-spacing-04)" }}>
            <span className="gs-info-label">API 서버 주소</span>
          </div>
          <div className="gs-url-row">
            <div className="gs-url-input-wrap">
              <input
                type="text"
                className="form-input gs-url-input"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setTestStatus("idle"); }}
                placeholder="http://localhost:3000"
                spellCheck={false}
              />
              {testStatus === "ok" && <span className="gs-url-badge gs-url-badge--ok"><Check size={12} /></span>}
              {testStatus === "error" && <span className="gs-url-badge gs-url-badge--error"><X size={12} /></span>}
              {testStatus === "testing" && <span className="gs-url-badge gs-url-badge--testing"><Spinner size={12} /></span>}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleTest}
              disabled={testStatus === "testing" || !url.trim()}
            >
              테스트
            </button>
            <button className="btn btn-sm" onClick={handleSave} disabled={!urlDirty && !saved}>
              {saved ? "저장됨" : "저장"}
            </button>
          </div>
          {testStatus !== "idle" && testStatus !== "testing" && (
            <div className={`gs-test-msg gs-test-msg--${testStatus}`}>
              {testStatus === "ok" ? `연결 성공 — ${testDetail}` : testDetail}
            </div>
          )}
          <button className="gs-reset-link" onClick={handleReset}>기본값으로 초기화</button>
        </div>

        {/* Theme */}
        <div className="card gs-section gs-bento__col-7">
          <div className="gs-section__header">
            <div className="gs-section__icon"><Sun size={20} /></div>
            <h3 className="gs-section__title">테마</h3>
          </div>
          <p style={{ fontSize: "var(--cds-type-sm)", color: "var(--cds-text-secondary)", marginBottom: "var(--cds-spacing-04)" }}>
            애플리케이션 테마를 설정합니다.
          </p>
          <div className="gs-theme-options">
            {([
              { value: "light" as const, icon: <Sun size={16} />, label: "라이트" },
              { value: "dark" as const, icon: <Moon size={16} />, label: "다크" },
              { value: "system" as const, icon: <Monitor size={16} />, label: "시스템" },
            ]).map((opt) => (
              <button
                key={opt.value}
                className={`gs-theme-btn${theme === opt.value ? " gs-theme-btn--active" : ""}`}
                onClick={() => handleThemeChange(opt.value)}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* API Access */}
        <div className="card gs-section gs-section--api gs-bento__col-5">
          <div className="gs-section__header">
            <div className="gs-section__icon"><Settings size={20} /></div>
            <h3 className="gs-section__title">API Access</h3>
          </div>
          <div className="gs-info-table">
            <div className="gs-info-row">
              <span className="gs-info-label">Endpoint</span>
              <span className="gs-api-endpoint">{url || "http://localhost:3000"}/api/v1</span>
            </div>
            <div className="gs-info-row">
              <span className="gs-info-label">Status</span>
              <span className={`gs-info-value${testStatus === "ok" ? "" : ""}`}
                style={{ color: testStatus === "ok" ? "var(--cds-support-success)" : testStatus === "error" ? "var(--cds-support-error)" : "var(--cds-text-secondary)" }}>
                {testStatus === "ok" ? "Connected" : testStatus === "error" ? "Error" : "—"}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
