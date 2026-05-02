import "./FilesUploadBanner.css";
import React from "react";
import { Spinner } from "@/common/ui/primitives";

interface FilesUploadBannerProps {
  message: string;
}

export const FilesUploadBanner: React.FC<FilesUploadBannerProps> = ({ message }) => (
  <div className="files-upload-banner">
    <Spinner size={18} />
    <span>{message}</span>
  </div>
);
