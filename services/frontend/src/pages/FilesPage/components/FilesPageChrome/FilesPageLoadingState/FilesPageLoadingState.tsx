import "./FilesPageLoadingState.css";
import React from "react";
import { Spinner } from "@/common/ui/primitives";

export const FilesPageLoadingState: React.FC = () => (
  <div className="page-loading-shell">
    <Spinner size={36} label="파일 로딩 중..." />
  </div>
);
