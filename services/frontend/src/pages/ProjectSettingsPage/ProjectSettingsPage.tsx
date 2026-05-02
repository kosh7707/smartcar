import React from "react";
import { useParams } from "react-router-dom";
import { useToast } from "@/common/contexts/ToastContext";
import { ConfirmDialog, ConnectionStatusBanner, Spinner } from "@/common/ui/primitives";
import { ProjectSettingsHeader } from "./components/ProjectSettingsHeader/ProjectSettingsHeader";
import { ProjectSettingsContent } from "./components/ProjectSettingsContent/ProjectSettingsContent";
import { useProjectSettingsPageController } from "./useProjectSettingsPageController";
import "./ProjectSettingsPage.css";

export const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const toast = useToast();
  const state = useProjectSettingsPageController(projectId, toast);

  if (state.loading) {
    return (
      <div className="page-loading-shell">
        <Spinner size={36} label="설정 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="page-shell ps-page">
      <ConnectionStatusBanner connectionState={state.sdkConnectionState} />

      <ProjectSettingsHeader
        project={state.project}
        projectId={projectId}
        sdkCount={state.registered.length}
        dirty={state.dirty}
        saving={state.saving}
        activeSection={state.activeSection}
        onCancel={state.handleCancel}
        onSave={state.handleSave}
        onSelectSection={(value) => state.setActiveSection(value)}
      />

      <div className="ps-page-body">
        <ProjectSettingsContent
          activeSection={state.activeSection}
          projectId={projectId}
          registered={state.registered}
          sdkProgressById={state.sdkProgressById}
          sdkErrorDetailsById={state.sdkErrorDetailsById}
          sdkQuota={state.sdkQuota}
          retryingSdkIds={state.retryingSdkIds}
          showForm={state.showForm}
          onToggleForm={() => state.setShowForm((prev) => !prev)}
          onRegistered={state.handleRegistered}
          onCancelForm={() => state.setShowForm(false)}
          onRequestDelete={state.setDeleteTarget}
          onRetry={state.handleRetry}
          name={state.name}
          description={state.description}
          onNameChange={state.handleNameChange}
          onDescriptionChange={state.handleDescriptionChange}
          onRequestDeleteProject={() => state.setShowDeleteProject(true)}
          deletingProject={state.deletingProject}
        />
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

      <ConfirmDialog
        open={state.showDeleteProject}
        title="프로젝트 삭제"
        message={state.project
          ? `"${state.project.name}" 프로젝트를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
          : "이 프로젝트를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다."}
        confirmLabel="삭제"
        danger
        onConfirm={() => void state.handleConfirmDeleteProject()}
        onCancel={() => state.setShowDeleteProject(false)}
      />
    </div>
  );
};
