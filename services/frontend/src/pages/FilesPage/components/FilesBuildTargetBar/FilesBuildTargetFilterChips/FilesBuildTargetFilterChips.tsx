import "./FilesBuildTargetFilterChips.css";
import React from "react";
import type { useBuildTargets } from "@/common/hooks/useBuildTargets";

interface FilesBuildTargetFilterChipsProps {
  targets: ReturnType<typeof useBuildTargets>["targets"];
  activeTargetFilters: Set<string>;
  onToggleFilter: (targetId: string) => void;
  onClearFilters: () => void;
}

export const FilesBuildTargetFilterChips: React.FC<FilesBuildTargetFilterChipsProps> = ({
  targets,
  activeTargetFilters,
  onToggleFilter,
  onClearFilters,
}) => {
  const allActive = activeTargetFilters.size === 0;
  return (
    <div className="files-build-target-bar__chips" role="group" aria-label="빌드 타겟 필터">
      <button
        type="button"
        className={`files-build-target-bar__chip${allActive ? " is-active" : ""}`}
        onClick={onClearFilters}
        aria-pressed={allActive}
      >
        전체
      </button>
      {targets.map((target) => {
        const isActive = activeTargetFilters.has(target.id);
        return (
          <button
            key={target.id}
            type="button"
            className={`files-build-target-bar__chip${isActive ? " is-active" : ""}`}
            onClick={() => onToggleFilter(target.id)}
            aria-pressed={isActive}
            title={target.name}
          >
            {target.name}
          </button>
        );
      })}
    </div>
  );
};
