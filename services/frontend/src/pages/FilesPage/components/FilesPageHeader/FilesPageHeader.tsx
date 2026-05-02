import "./FilesPageHeader.css";
import React from "react";
import { FilesPageHeaderTitle } from "./FilesPageHeaderTitle/FilesPageHeaderTitle";
import { FilesPageHeaderActions } from "./FilesPageHeaderActions/FilesPageHeaderActions";

interface FilesPageHeaderProps {
  onOpenUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenCreateDialog: () => void;
}

export const FilesPageHeader: React.FC<FilesPageHeaderProps> = ({
  onOpenUpload,
  fileInputRef,
  onFileInputChange,
  onOpenCreateDialog,
}) => (
  <header className="page-header page-header--plain page-head files-page-header">
    <FilesPageHeaderTitle />
    <FilesPageHeaderActions
      onOpenUpload={onOpenUpload}
      fileInputRef={fileInputRef}
      onFileInputChange={onFileInputChange}
      onOpenCreateDialog={onOpenCreateDialog}
    />
  </header>
);
