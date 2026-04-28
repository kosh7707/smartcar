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
          <table className="files-build-targets">
            <colgroup>
              <col style={{ width: "220px" }} />
              <col style={{ width: "110px" }} />
              <col />
              <col style={{ width: "140px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>이름</th>
                <th>상태</th>
                <th>경로</th>
                <th aria-label="액션" />
              </tr>
            </thead>
            <tbody>
              {targets.map((target) => {
                const status = target.status ?? "discovered";
                const actionable = target.status && target.status !== "discovered";
                return (
                  <tr key={target.id}>
                    <td className="files-build-targets__name">{target.name}</td>
                    <td>
                      <TargetStatusBadge status={status} />
                    </td>
                    <td className="files-build-targets__path">{target.relativePath}</td>
                    <td className="files-build-targets__action-cell">
                      {actionable && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => onOpenLog({ id: target.id, name: target.name })}
                          title="빌드 로그"
                        >
                          <ScrollText size={14} />
                          빌드 로그
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
