import "./FilesPreviewLoadingState.css";
import React from "react";
import { Spinner } from "@/common/ui/primitives";

export const FilesPreviewLoadingState: React.FC = () => (
  <div className="files-workspace-loading-preview">
    <Spinner label="로딩 중..." />
  </div>
);
