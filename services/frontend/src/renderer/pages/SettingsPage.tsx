import React, { useState } from "react";
import { Settings, Server, Info, Check, X, Sun, Moon, Monitor } from "lucide-react";
import { getBackendUrl, setBackendUrl, healthFetch } from "../api/client";
import { getThemePreference, setThemePreference, type ThemePreference } from "../utils/theme";
import { PageHeader, Spinner } from "../components/ui";
import "./SettingsPage.css";

type TestStatus = "idle" | "testing" | "ok" | "error";

export const SettingsPage: React.FC = () => {
  const [url, setUrl] = useState(getBackendUrl);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testDetail, setTestDetail] = useState("");
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);

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
      <PageHeader title="설정" icon={<Settings size={20} />} />

      {/* Backend Server */}
      <div className="card gs-card">
        <div className="gs-card__header">
          <div className="gs-card__icon"><Server size={18} /></div>
          <div>
            <div className="gs-card__title">백엔드 서버</div>
            <div className="gs-card__desc">API 요청을 보낼 백엔드 서버 주소를 설정합니다.</div>
          </div>
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
      <div className="card gs-card">
        <div className="gs-card__header">
          <div className="gs-card__icon"><Sun size={18} /></div>
          <div>
            <div className="gs-card__title">테마</div>
            <div className="gs-card__desc">애플리케이션 테마를 설정합니다.</div>
          </div>
        </div>

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

      {/* Info */}
      <div className="card gs-card">
        <div className="gs-card__header">
          <div className="gs-card__icon"><Info size={18} /></div>
          <div>
            <div className="gs-card__title">정보</div>
          </div>
        </div>

        <div className="gs-info-table">
          <div className="gs-info-row">
            <span className="gs-info-label">버전</span>
            <span className="gs-info-value"><code>v0.1.0</code></span>
          </div>
          <div className="gs-info-row">
            <span className="gs-info-label">프레임워크</span>
            <span className="gs-info-value">Smartcar Security Framework</span>
          </div>
          <div className="gs-info-row">
            <span className="gs-info-label">라이선스</span>
            <span className="gs-info-value">Internal Use</span>
          </div>
        </div>
      </div>
    </div>
  );
};
