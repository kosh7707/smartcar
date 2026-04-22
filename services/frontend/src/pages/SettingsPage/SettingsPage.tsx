import React from "react";
import { PageHeader } from "../../shared/ui";
import { SettingsApiAccessSection } from "./components/SettingsApiAccessSection";
import { SettingsBackendSection } from "./components/SettingsBackendSection";
import { SettingsPlatformSection } from "./components/SettingsPlatformSection";
import { SettingsThemeSection } from "./components/SettingsThemeSection";
import { useSettingsPage } from "./hooks/useSettingsPage";
import "./SettingsPage.css";

export const SettingsPage: React.FC = () => {
  const {
    url,
    saved,
    testStatus,
    testDetail,
    theme,
    urlDirty,
    handleUrlChange,
    handleThemeChange,
    handleSave,
    handleReset,
    handleCancel,
    handleTest,
  } = useSettingsPage();

  return (
    <div className="page-shell settings-page">
      <PageHeader
        surface="plain"
        title="시스템 설정"
        action={
          urlDirty ? (
            <div className="settings-header-actions" role="group" aria-label="변경사항 제어">
              <span className="settings-header-actions__dirty" aria-hidden="true">●</span>
              <span className="settings-header-actions__label">저장되지 않은 변경</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCancel}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSave}
              >
                {saved ? "저장됨" : "저장"}
              </button>
            </div>
          ) : null
        }
      />

      <section className="settings-section settings-section--1">
        <header className="settings-section__head">
          <span className="settings-section__label">Backend</span>
          <span className="settings-section__meta">api.v1</span>
        </header>
        <SettingsBackendSection
          url={url}
          testStatus={testStatus}
          testDetail={testDetail}
          onUrlChange={handleUrlChange}
          onTest={handleTest}
          onReset={handleReset}
        />
      </section>

      <section className="settings-section settings-section--2">
        <header className="settings-section__head">
          <span className="settings-section__label">Appearance</span>
          <span className="settings-section__meta">local preference</span>
        </header>
        <SettingsThemeSection theme={theme} onThemeChange={handleThemeChange} />
      </section>

      <section className="settings-section settings-section--3">
        <header className="settings-section__head">
          <span className="settings-section__label">Endpoint</span>
          <span className="settings-section__meta">derived</span>
        </header>
        <SettingsApiAccessSection url={url} testStatus={testStatus} />
      </section>

      <section className="settings-section settings-section--4">
        <header className="settings-section__head">
          <span className="settings-section__label">Platform</span>
          <span className="settings-section__meta">runtime</span>
        </header>
        <SettingsPlatformSection />
      </section>
    </div>
  );
};
