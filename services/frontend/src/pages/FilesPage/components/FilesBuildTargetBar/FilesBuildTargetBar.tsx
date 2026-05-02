import "./FilesBuildTargetBar.css";
import React from "react";
import type { useBuildTargets } from "@/common/hooks/useBuildTargets";
import { FilesBuildTargetFilterChips } from "./FilesBuildTargetFilterChips/FilesBuildTargetFilterChips";

interface FilesBuildTargetBarProps {
  targets: ReturnType<typeof useBuildTargets>["targets"];
  activeTargetFilters: Set<string>;
  onToggleFilter: (targetId: string) => void;
  onClearFilters: () => void;
}

export const FilesBuildTargetBar: React.FC<FilesBuildTargetBarProps> = ({
  targets,
  activeTargetFilters,
  onToggleFilter,
  onClearFilters,
}) => (
  <div className="files-build-target-bar">
    <FilesBuildTargetFilterChips
      targets={targets}
      activeTargetFilters={activeTargetFilters}
      onToggleFilter={onToggleFilter}
      onClearFilters={onClearFilters}
    />
  </div>
);
