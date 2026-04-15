import React from "react";
import { Check, Server, X } from "lucide-react";
import { Spinner } from "../../../shared/ui";
import type { TestStatus } from "../hooks/useSettingsPage";

type SettingsBackendSectionProps = {
  url: string;
  urlDirty: boolean;
  saved: boolean;
  testStatus: TestStatus;
  testDetail: string;
  onUrlChange: (value: string) => void;
  onTest: () => void;
  onSave: () => void;
  onReset: () => void;
};

export function SettingsBackendSection({
  url,
  urlDirty,
  saved,
  testStatus,
  testDetail,
  onUrlChange,
  onTest,
  onSave,
  onReset,
}: SettingsBackendSectionProps) {
  return (
    <section className="gs-section gs-section--surface gs-bento__col-8">
      <div className="gs-section__header">
        <div className="gs-section__icon"><Server size={20} /></div>
        <h3 className="gs-section__title">백엔드 연결</h3>
      </div>
      <div className="gs-info-row gs-info-row--stacked">
        <span className="gs-info-label">API 서버 주소</span>
      </div>
      <div className="gs-url-row">
        <div className="gs-url-input-wrap">
          <input
            type="text"
            className="form-input gs-url-input"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="http://localhost:3000"
            spellCheck={false}
          />
          {testStatus === "ok" && <span className="gs-url-badge gs-url-badge--ok"><Check size={12} /></span>}
          {testStatus === "error" && <span className="gs-url-badge gs-url-badge--error"><X size={12} /></span>}
          {testStatus === "testing" && <span className="gs-url-badge gs-url-badge--testing"><Spinner size={12} /></span>}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onTest}
          disabled={testStatus === "testing" || !url.trim()}
        >
          테스트
        </button>
        <button className="btn btn-sm" onClick={onSave} disabled={!urlDirty && !saved}>
          {saved ? "저장됨" : "저장"}
        </button>
      </div>
      {testStatus !== "idle" && testStatus !== "testing" && (
        <div className={`gs-test-msg gs-test-msg--${testStatus}`}>
          {testStatus === "ok" ? `연결 성공 — ${testDetail}` : testDetail}
        </div>
      )}
      <button className="gs-reset-link" onClick={onReset}>기본값으로 초기화</button>
    </section>
  );
}
