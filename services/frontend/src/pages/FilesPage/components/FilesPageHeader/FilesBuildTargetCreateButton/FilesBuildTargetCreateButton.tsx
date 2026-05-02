import "./FilesBuildTargetCreateButton.css";
import React from "react";
import { Plus } from "lucide-react";

interface FilesBuildTargetCreateButtonProps {
  onClick: () => void;
}

export const FilesBuildTargetCreateButton: React.FC<FilesBuildTargetCreateButtonProps> = ({
  onClick,
}) => (
  <button
    type="button"
    className="btn btn-outline btn-sm"
    onClick={onClick}
    title="빌드 타겟 설정"
  >
    <Plus size={14} />
    빌드 타겟 설정
  </button>
);
