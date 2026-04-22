import React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="settings-field">
      <label className="settings-field__label" htmlFor="backend-url">
        API 서버 주소
      </label>
      <p className="settings-field__hint">
        분석 파이프라인이 호출할 내부 API의 루트 주소입니다. 저장하면 즉시 적용됩니다.
      </p>
      <div className="settings-action-row">
        <div className="settings-url">
          <input
            id="backend-url"
            type="text"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="http://localhost:3000"
            spellCheck={false}
            className="settings-url__input"
          />
          {testStatus === "ok" ? (
            <span className="settings-url__indicator settings-url__indicator--ok" aria-hidden="true">
              <Check size={12} />
            </span>
          ) : null}
          {testStatus === "error" ? (
            <span className="settings-url__indicator settings-url__indicator--error" aria-hidden="true">
              <X size={12} />
            </span>
          ) : null}
          {testStatus === "testing" ? (
            <span className="settings-url__indicator settings-url__indicator--testing" aria-hidden="true">
              <Spinner size={12} />
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onTest}
          disabled={testStatus === "testing" || !url.trim()}
        >
          테스트
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onSave}
          disabled={!urlDirty && !saved}
        >
          {saved ? "저장됨" : "저장"}
        </button>
      </div>

      {testStatus !== "idle" && testStatus !== "testing" ? (
        <p
          className={cn(
            "settings-status",
            testStatus === "ok" && "settings-status--ok",
            testStatus === "error" && "settings-status--error",
          )}
          role="status"
        >
          {testStatus === "ok" ? `연결 성공 — ${testDetail}` : testDetail}
        </p>
      ) : null}

      <button type="button" className="settings-reset" onClick={onReset}>
        기본값으로 초기화
      </button>
    </div>
  );
}
