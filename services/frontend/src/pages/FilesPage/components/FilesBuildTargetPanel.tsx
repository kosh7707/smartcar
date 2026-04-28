import React from "react";
import { Plus, ScrollText } from "lucide-react";
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
        <div className="files-build-target-panel__copy">
          <h3 className="panel-title files-build-target-panel__title">빌드 타겟 현황</h3>
          <span className="files-build-target-panel__summary">
            {targets.length > 0 ? `${targets.length}개 타겟 · compile_commands 컨텍스트` : "타겟 생성 후 빌드 로그를 확인할 수 있습니다"}
          </span>
        </div>
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
              <col style={{ width: "156px" }} />
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
                      <TargetStatusBadge status={status} size="sm" />
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
