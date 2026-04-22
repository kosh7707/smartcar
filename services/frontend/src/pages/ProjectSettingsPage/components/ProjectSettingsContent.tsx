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

  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;

  onRequestDeleteProject: () => void;
  deletingProject: boolean;
};

export function ProjectSettingsContent(props: ProjectSettingsContentProps) {
  const { activeSection } = props;

  if (activeSection === "general") {
    return (
      <section className="panel" role="tabpanel" aria-label="일반">
        <div className="panel-head">
          <h3>일반 <span className="count">identity</span></h3>
        </div>
        <div className="panel-body">
          <GeneralSettingsSection
            name={props.name}
            description={props.description}
            onNameChange={props.onNameChange}
            onDescriptionChange={props.onDescriptionChange}
          />
        </div>
      </section>
    );
  }

  if (activeSection === "sdk") {
    if (!props.projectId) {
      return (
        <PlaceholderSettingsSection
          panelLabel="SDK 관리"
          title="프로젝트 정보가 필요합니다"
          description="프로젝트를 선택한 뒤 SDK 설정을 관리할 수 있습니다."
        />
      );
    }
    return (
      <SdkManagementSection
        projectId={props.projectId}
        registered={props.registered}
        sdkProgressById={props.sdkProgressById}
        showForm={props.showForm}
        onToggleForm={props.onToggleForm}
        onRegistered={props.onRegistered}
        onCancelForm={props.onCancelForm}
        onRequestDelete={props.onRequestDelete}
      />
    );
  }

  if (activeSection === "build-targets") {
    return (
      <PlaceholderSettingsSection
        panelLabel="빌드 타겟"
        title="빌드 타겟 설정은 준비 중입니다"
        description="이 기능은 곧 제공될 예정입니다."
      />
    );
  }

  if (activeSection === "notifications") {
    return (
      <PlaceholderSettingsSection
        panelLabel="알림"
        title="프로젝트 알림 설정은 준비 중입니다"
        description="이 기능은 곧 제공될 예정입니다."
      />
    );
  }

  if (activeSection === "adapters") {
    return (
      <PlaceholderSettingsSection
        panelLabel="어댑터"
        title="동적 분석 어댑터 설정은 준비 중입니다"
        description="이 기능은 곧 제공될 예정입니다."
      />
    );
  }

  return (
    <DangerZoneSection
      onRequestDelete={props.onRequestDeleteProject}
      deleting={props.deletingProject}
    />
  );
}
