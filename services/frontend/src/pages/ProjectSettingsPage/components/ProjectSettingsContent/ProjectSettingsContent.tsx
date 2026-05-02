import "./ProjectSettingsContent.css";
import React from "react";
import type { RegisteredSdk, SdkQuota } from "@/common/api/sdk";
import type { SdkProgressDetails, SdkErrorEventDetails } from "@/common/hooks/useSdkProgress";
import { DangerZoneSection } from "../DangerZoneSection/DangerZoneSection";
import { GeneralSettingsSection } from "../GeneralSettingsSection/GeneralSettingsSection";
import { PlaceholderSettingsSection } from "../PlaceholderSettingsSection/PlaceholderSettingsSection";
import { SdkManagementSection } from "../SdkManagementSection/SdkManagementSection";
import type { SettingsSection } from "../ProjectSettingsTabStrip/ProjectSettingsTabStrip";

type ProjectSettingsContentProps = {
  activeSection: SettingsSection;
  projectId?: string;
  registered: RegisteredSdk[];
  sdkProgressById: Record<string, SdkProgressDetails>;
  sdkErrorDetailsById: Record<string, SdkErrorEventDetails>;
  sdkQuota: SdkQuota | null;
  retryingSdkIds: Set<string>;
  showForm: boolean;
  onToggleForm: () => void;
  onRegistered: (sdk: RegisteredSdk) => void;
  onCancelForm: () => void;
  onRequestDelete: (sdk: RegisteredSdk) => void;
  onRetry: (sdk: RegisteredSdk) => void;

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
      <GeneralSettingsSection
        projectId={props.projectId}
        name={props.name}
        description={props.description}
        onNameChange={props.onNameChange}
        onDescriptionChange={props.onDescriptionChange}
      />
    );
  }

  if (activeSection === "sdk") {
    if (!props.projectId) {
      return (
        <PlaceholderSettingsSection
          kind="build-targets"
          paneId="sdk"
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
        sdkErrorDetailsById={props.sdkErrorDetailsById}
        sdkQuota={props.sdkQuota}
        retryingSdkIds={props.retryingSdkIds}
        showForm={props.showForm}
        onToggleForm={props.onToggleForm}
        onRegistered={props.onRegistered}
        onCancelForm={props.onCancelForm}
        onRequestDelete={props.onRequestDelete}
        onRetry={props.onRetry}
      />
    );
  }

  if (activeSection === "build-targets") {
    return (
      <PlaceholderSettingsSection
        kind="build-targets"
        paneId="build-targets"
        panelLabel="빌드 타겟"
        title="빌드 타겟 설정은 준비 중입니다"
        description="각 SDK와 컴파일 옵션을 BuildTarget 프리셋으로 묶어, 정적·동적 분석 시 한 번의 클릭으로 선택할 수 있게 됩니다."
      />
    );
  }

  if (activeSection === "notifications") {
    return (
      <PlaceholderSettingsSection
        kind="notifications"
        paneId="notifications"
        panelLabel="알림"
        title="프로젝트 알림 설정은 준비 중입니다"
        description="Slack·Email 채널별로 이벤트 필터(severity, source, module)를 설정할 수 있게 됩니다. 현재는 전역 사용자 설정에서 알림을 관리하세요."
      />
    );
  }

  if (activeSection === "adapters") {
    return (
      <PlaceholderSettingsSection
        kind="adapters"
        paneId="adapters"
        panelLabel="어댑터"
        title="동적 분석 어댑터 설정은 준비 중입니다"
        description="J-Link·ST-Link·OpenOCD 등 디버그 어댑터와 시리얼·네트워크 연결을 프로젝트 레벨에서 등록합니다. 현재는 동적 분석 세션별로 선택할 수 있습니다."
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
