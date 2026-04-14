import React from "react";
import type { RegisteredSdk } from "../../../api/sdk";
import type { SdkProgressDetails } from "../../../hooks/useSdkProgress";
import { DangerZoneSection } from "./DangerZoneSection";
import { GeneralSettingsSection } from "./GeneralSettingsSection";
import { PlaceholderSettingsSection } from "./PlaceholderSettingsSection";
import { SdkManagementSection } from "./SdkManagementSection";
import type { SettingsSection } from "./ProjectSettingsSidebar";

type ProjectSettingsContentProps = {
  activeSection: SettingsSection;
  projectId?: string;
  registered: RegisteredSdk[];
  sdkProgressById: Record<string, SdkProgressDetails>;
  showForm: boolean;
  onToggleForm: () => void;
  onRegistered: (sdk: RegisteredSdk) => void;
  onCancelForm: () => void;
  onRequestDelete: (sdk: RegisteredSdk) => void;
};

export function ProjectSettingsContent({
  activeSection,
  projectId,
  registered,
  sdkProgressById,
  showForm,
  onToggleForm,
  onRegistered,
  onCancelForm,
  onRequestDelete,
}: ProjectSettingsContentProps) {
  if (activeSection === "general") {
    return <GeneralSettingsSection />;
  }

  if (activeSection === "sdk" && projectId) {
    return (
      <SdkManagementSection
        projectId={projectId}
        registered={registered}
        sdkProgressById={sdkProgressById}
        showForm={showForm}
        onToggleForm={onToggleForm}
        onRegistered={onRegistered}
        onCancelForm={onCancelForm}
        onRequestDelete={onRequestDelete}
      />
    );
  }

  if (activeSection === "build-targets") {
    return (
      <PlaceholderSettingsSection
        title="빌드 타겟 설정은 준비 중입니다"
        description="이 기능은 곧 제공될 예정입니다."
      />
    );
  }

  if (activeSection === "notifications") {
    return (
      <PlaceholderSettingsSection
        title="프로젝트 알림 설정은 준비 중입니다"
        description="이 기능은 곧 제공될 예정입니다."
      />
    );
  }

  if (activeSection === "adapters") {
    return (
      <PlaceholderSettingsSection
        title="동적 분석 어댑터 설정은 준비 중입니다"
        description="이 기능은 곧 제공될 예정입니다."
      />
    );
  }

  return <DangerZoneSection />;
}
