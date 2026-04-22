import React from "react";
import { HardDrive, Plus, ScrollText } from "lucide-react";
import type { useBuildTargets } from "../../../hooks/useBuildTargets";
import { TargetStatusBadge } from "../../../shared/ui";

export function FilesBuildTargetPanel({
  targets,
  onOpenLog,
  onOpenCreateTarget,
}: {
  targets: ReturnType<typeof useBuildTargets>["targets"];
  onOpenLog: (target: { id: string; name: string }) => void;
  onOpenCreateTarget: () => void;
}) {
  return (
    <div className="panel files-build-target-panel">
      <div className="panel-head files-build-target-panel__head">
        <h3 className="panel-title files-build-target-panel__title">
          <HardDrive size={16} />
          빌드 타겟 현황
          {targets.length > 0 && (
            <span className="files-build-target-panel__title-count">({targets.length}개)</span>
          )}
        </h3>
        <button type="button" className="btn btn-primary btn-sm" onClick={onOpenCreateTarget}>
          <Plus size={14} />
          빌드 타겟 생성
        </button>
      </div>
      <div className="panel-body files-build-target-panel__body">
        {targets.length === 0 ? (
          <div className="files-build-target-panel__empty">
            아직 생성된 빌드 타겟이 없습니다.
          </div>
        ) : (
          targets.map((target) => (
            <div key={target.id} className="files-build-target-panel__row">
              <span className="files-build-target-panel__name">{target.name}</span>
              <TargetStatusBadge status={target.status ?? "discovered"} />
              <span className="files-build-target-panel__path">{target.relativePath}</span>
              {target.status && target.status !== "discovered" && (
                <button type="button" className="btn btn-outline btn-sm"
                  onClick={() => onOpenLog({ id: target.id, name: target.name })}
                  title="빌드 로그"
                >
                  <ScrollText size={14} />
                  빌드 로그
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
