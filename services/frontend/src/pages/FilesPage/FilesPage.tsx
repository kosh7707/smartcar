import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import { Spinner } from "../../shared/ui";
import { useToast } from "../../contexts/ToastContext";
import { useUploadProgress } from "../../hooks/useUploadProgress";
import { useBuildTargets } from "../../hooks/useBuildTargets";
import { FilesEmptyState } from "./components/FilesEmptyState";
import { BuildTargetCreateDialog } from "./components/BuildTargetCreateDialog";
import { BuildLogViewer } from "./components/BuildLogViewer";
import { FilesPageHeader } from "./components/FilesPageHeader";
import { FilesLanguageSummary } from "./components/FilesLanguageSummary";
import { FilesBuildTargetPanel } from "./components/FilesBuildTargetPanel";
import { FilesSourceWorkspace } from "./components/FilesSourceWorkspace";
import { useFilesPage } from "./hooks/useFilesPage";
import "./FilesPage.css";

export const FilesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const upload = useUploadProgress();
  const bt = useBuildTargets(projectId);
  const state = useFilesPage(projectId, navigate, toast, upload, bt);

  if (state.loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="파일 로딩 중..." />
      </div>
    );
  }

  if (!projectId) return null;

  return (
    <div
      className={`page-enter fpage${state.dragOver ? " fpage--dragover" : ""}`}
      onDragOver={(event) => { event.preventDefault(); state.setDragOver(true); }}
      onDragLeave={(event) => { event.preventDefault(); state.setDragOver(false); }}
      onDrop={state.handleDrop}
    >
      <FilesPageHeader
        fileCount={state.sourceFiles.length}
        totalSize={state.totalSize}
        showCreateTarget={state.sourceFiles.length > 0}
        onOpenCreateTarget={() => state.setShowBuildTargetDialog(true)}
        onOpenUpload={() => state.fileInputRef.current?.click()}
        fileInputRef={state.fileInputRef}
        onFileInputChange={(event) => event.target.files && state.handleUpload(event.target.files)}
      />

      {state.upload.isActive && (
        <div className="fpage-upload-banner">
          <Spinner size={18} />
          <span>{state.upload.message}</span>
        </div>
      )}

      {state.sourceFiles.length === 0 && !state.upload.isActive ? (
        <FilesEmptyState />
      ) : (
        <>
          <FilesLanguageSummary totalFiles={state.sourceFiles.length} langStats={state.langStats} />

          <FilesBuildTargetPanel targets={state.buildTargets.targets} onOpenLog={state.setLogTarget} />

          <FilesSourceWorkspace
            search={state.search}
            onSearchChange={state.setSearch}
            onExpandAll={state.onExpandAll}
            onCollapseAll={state.onCollapseAll}
            displayTree={state.displayTree}
            selectedPath={state.selectedPath}
            handleFileClick={state.handleFileClick}
            renderFileIcon={state.renderFileIcon}
            renderFileMeta={state.renderFileMeta}
            renderFolderBadge={state.renderFolderBadge}
            previewLoading={state.previewLoading}
            previewLang={state.previewLang}
            previewContent={state.previewContent}
            highlightLines={state.highlightLines}
            selectedFileFindings={state.selectedFileFindings}
            onSelectFinding={state.handleSelectFinding}
            openPaths={state.effectiveOpenPaths}
            onToggleFolder={state.onToggleFolder}
            layoutRef={state.workspaceLayout.layoutRef}
            treePanelWidth={state.workspaceLayout.treePanelWidth}
            isResizing={state.workspaceLayout.isResizing}
            onStartResize={state.workspaceLayout.startResizing}
            onNudgeResize={state.workspaceLayout.nudgeResize}
          />
        </>
      )}

      {state.dragOver && (
        <div className="fpage-drop-overlay">
          <Upload size={40} />
          <span>파일을 여기에 놓으세요</span>
        </div>
      )}

      <BuildTargetCreateDialog
        open={state.showBuildTargetDialog}
        projectId={projectId}
        sourceFiles={state.sourceFiles}
        onCreated={state.onBuildTargetCreated}
        onCancel={() => state.setShowBuildTargetDialog(false)}
      />

      {state.logTarget && projectId && (
        <BuildLogViewer
          projectId={projectId}
          targetId={state.logTarget.id}
          targetName={state.logTarget.name}
          onClose={() => state.setLogTarget(null)}
        />
      )}
    </div>
  );
};
