import React from "react";
import { useParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { ConfirmDialog, ConnectionStatusBanner, Spinner } from "../../shared/ui";
import { ProjectSettingsSidebar, type SettingsSection } from "./components/ProjectSettingsSidebar";
import { ProjectSettingsHeader } from "./components/ProjectSettingsHeader";
import { ProjectSettingsContent } from "./components/ProjectSettingsContent";
import { useProjectSettingsPage } from "./hooks/useProjectSettingsPage";
import "./ProjectSettingsPage.css";

export const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const toast = useToast();
  const state = useProjectSettingsPage(projectId, toast);

  if (state.loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="설정 로딩 중..." />
      </div>
    );
  }

  return (
    <div className={`page-enter project-settings-page project-settings-page--${state.activeSection}`}>
      <ConnectionStatusBanner connectionState={state.sdkConnectionState} />
      <ProjectSettingsHeader />

      <div className="project-settings-layout">
        <ProjectSettingsSidebar activeSection={state.activeSection} onSelect={state.setActiveSection} />

        <div className="project-settings-content">
          <ProjectSettingsContent
            activeSection={state.activeSection}
            projectId={projectId}
            registered={state.registered}
            sdkProgressById={state.sdkProgressById}
            showForm={state.showForm}
            onToggleForm={() => state.setShowForm((prev) => !prev)}
            onRegistered={state.handleRegistered}
            onCancelForm={() => state.setShowForm(false)}
            onRequestDelete={state.setDeleteTarget}
          />
        </div>
      </div>

      <ConfirmDialog
        open={state.deleteTarget !== null}
        title="SDK 삭제"
        message={state.deleteTarget ? `"${state.deleteTarget.name}" SDK를 삭제하시겠습니까?` : ""}
        confirmLabel="삭제"
        danger
        onConfirm={() => state.deleteTarget && state.handleDelete(state.deleteTarget)}
        onCancel={() => state.setDeleteTarget(null)}
      />
    </div>
  );
};
