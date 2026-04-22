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
  return (
    <>
      <div role="tabpanel" value="general" className="project-settings-content__panel">
        <GeneralSettingsSection />
      </div>

      <div role="tabpanel" value="sdk" className="project-settings-content__panel">
        {projectId ? (
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
        ) : (
          <PlaceholderSettingsSection
            title="프로젝트 정보가 필요합니다"
            description="프로젝트를 선택한 뒤 SDK 설정을 관리할 수 있습니다."
          />
        )}
      </div>

      <div role="tabpanel" value="build-targets" className="project-settings-content__panel">
        <PlaceholderSettingsSection
          title="빌드 타겟 설정은 준비 중입니다"
          description="이 기능은 곧 제공될 예정입니다."
        />
      </div>

      <div role="tabpanel" value="notifications" className="project-settings-content__panel">
        <PlaceholderSettingsSection
          title="프로젝트 알림 설정은 준비 중입니다"
          description="이 기능은 곧 제공될 예정입니다."
        />
      </div>

      <div role="tabpanel" value="adapters" className="project-settings-content__panel">
        <PlaceholderSettingsSection
          title="동적 분석 어댑터 설정은 준비 중입니다"
          description="이 기능은 곧 제공될 예정입니다."
        />
      </div>

      <div role="tabpanel" value="danger" className="project-settings-content__panel">
        <DangerZoneSection />
      </div>
    </>
  );
}
