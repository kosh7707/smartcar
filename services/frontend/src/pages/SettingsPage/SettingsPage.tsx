import React from "react";
import { PageHeader } from "../../shared/ui";
import { SettingsApiAccessSection } from "./components/SettingsApiAccessSection";
import { SettingsBackendSection } from "./components/SettingsBackendSection";
import { SettingsHeaderActions } from "./components/SettingsHeaderActions";
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
    <div className="page-enter settings-page">
      <PageHeader
        surface="plain"
        title="시스템 설정"
        subtitle="전역 연결, 테마, 런타임 환경을 운영 기준으로 정리합니다."
        action={<SettingsHeaderActions saved={saved} urlDirty={urlDirty} onReset={handleReset} onSave={handleSave} />}
      />

      <div className="gs-bento">
        <SettingsPlatformSection />
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
        <SettingsThemeSection theme={theme} onThemeChange={handleThemeChange} />
        <SettingsApiAccessSection url={url} testStatus={testStatus} />
      </div>
    </div>
  );
};
