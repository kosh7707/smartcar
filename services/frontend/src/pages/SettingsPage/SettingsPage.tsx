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
    handleTest,
  } = useSettingsPage();

  return (
    <div className="page-shell settings-page">
      <PageHeader surface="plain" title="시스템 설정" />

      <section className="settings-section settings-section--1">
        <header className="settings-section__head">
          <span className="settings-section__label">Backend</span>
          <span className="settings-section__meta">api.v1</span>
        </header>
        <SettingsBackendSection
          url={url}
          urlDirty={urlDirty}
          saved={saved}
          testStatus={testStatus}
          testDetail={testDetail}
          onUrlChange={handleUrlChange}
          onTest={handleTest}
          onSave={handleSave}
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
