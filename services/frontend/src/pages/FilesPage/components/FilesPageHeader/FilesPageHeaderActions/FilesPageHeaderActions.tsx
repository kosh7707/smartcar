import "./FilesPageHeaderActions.css";
import React from "react";
import { FilesSourceUploadButton } from "../FilesSourceUploadButton/FilesSourceUploadButton";
import { FilesBuildTargetCreateButton } from "../FilesBuildTargetCreateButton/FilesBuildTargetCreateButton";

interface FilesPageHeaderActionsProps {
  onOpenUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenCreateDialog: () => void;
}

export const FilesPageHeaderActions: React.FC<FilesPageHeaderActionsProps> = ({
  onOpenUpload,
  fileInputRef,
  onFileInputChange,
  onOpenCreateDialog,
}) => (
  <div className="page-header__action actions files-page-header-actions">
    <FilesSourceUploadButton
      onOpenUpload={onOpenUpload}
      fileInputRef={fileInputRef}
      onFileInputChange={onFileInputChange}
    />
    <FilesBuildTargetCreateButton onClick={onOpenCreateDialog} />
  </div>
);
