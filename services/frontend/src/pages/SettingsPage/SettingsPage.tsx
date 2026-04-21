import React from "react";
import { PageHeader } from "../../shared/ui";
import { SettingsApiAccessSection } from "./components/SettingsApiAccessSection";
import { SettingsBackendSection } from "./components/SettingsBackendSection";
import { SettingsHeaderActions } from "./components/SettingsHeaderActions";
import { SettingsPlatformSection } from "./components/SettingsPlatformSection";
import { SettingsThemeSection } from "./components/SettingsThemeSection";
import { useSettingsPage } from "./hooks/useSettingsPage";

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
    <div className="page-shell">
      <PageHeader
        surface="plain"
        title="시스템 설정"
        action={
          <SettingsHeaderActions
            saved={saved}
            urlDirty={urlDirty}
            onReset={handleReset}
            onSave={handleSave}
          />
        }
      />

      <div className="settings-page-layout">
        <div className="settings-page-layout__platform">
          <SettingsPlatformSection />
        </div>
        <div className="settings-page-layout__backend">
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
        </div>
        <div className="settings-page-layout__theme">
          <SettingsThemeSection theme={theme} onThemeChange={handleThemeChange} />
        </div>
        <div className="settings-page-layout__api">
          <SettingsApiAccessSection url={url} testStatus={testStatus} />
        </div>
      </div>
    </div>
  );
};
