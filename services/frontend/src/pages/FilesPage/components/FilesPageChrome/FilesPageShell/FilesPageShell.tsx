import "./FilesPageShell.css";
import React from "react";

interface FilesPageShellProps {
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  children: React.ReactNode;
}

export const FilesPageShell: React.FC<FilesPageShellProps> = ({
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}) => (
  <div
    className="page-shell files-page"
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
  >
    {children}
  </div>
);
