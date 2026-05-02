import "./FilesDropOverlay.css";
import React from "react";
import { Upload } from "lucide-react";

export const FilesDropOverlay: React.FC = () => (
  <div className="files-drop-overlay">
    <Upload size={40} />
    <span>파일을 여기에 놓으세요</span>
  </div>
);
