import React from "react";
import { HardDrive, ScrollText } from "lucide-react";
import type { useBuildTargets } from "../../../hooks/useBuildTargets";
import { TargetStatusBadge } from "../../../shared/ui";

export function FilesBuildTargetPanel({
  targets,
  onOpenLog,
}: {
  targets: ReturnType<typeof useBuildTargets>["targets"];
  onOpenLog: (target: { id: string; name: string }) => void;
}) {
  if (targets.length === 0) return null;

  return (
    <div className="card fpage-build-target-card">
      <div className="card-title flex-center flex-gap-2">
        <HardDrive size={16} />
        BuildTarget ({targets.length}개)
      </div>
      <div className="fpage-build-target-list">
        {targets.map((target) => (
          <div key={target.id} className="fpage-build-target-row">
            <span className="fpage-build-target-name">{target.name}</span>
            <TargetStatusBadge status={target.status ?? "discovered"} size="sm" />
            <span className="fpage-build-target-meta">{target.relativePath}</span>
            {target.status && target.status !== "discovered" && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onOpenLog({ id: target.id, name: target.name })}
                title="빌드 로그"
              >
                <ScrollText size={14} />
                빌드 로그
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
