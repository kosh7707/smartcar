import React, { useMemo } from "react";
import { HardDrive, Pencil, Play, Plus, ScrollText } from "lucide-react";
import type { useBuildTargets } from "../../../hooks/useBuildTargets";
import { TargetStatusBadge } from "../../../shared/ui";
import type { SourceFileEntry, TargetMappingEntry } from "../../../api/client";

const UNTARGETED_KEY = "__untargeted__";

interface Coverage {
  total: number;
  uncovered: number;
  pct: number;
}

interface FilesBuildTargetPanelProps {
  targets: ReturnType<typeof useBuildTargets>["targets"];
  sourceFiles: SourceFileEntry[];
  targetMapping: Record<string, TargetMappingEntry>;
  activeTargetFilters: Set<string>;
  onToggleFilter: (targetKey: string) => void;
  onClearFilters: () => void;
  onOpenLog: (target: { id: string; name: string }) => void;
  onOpenCreateTarget: () => void;
}

export function FilesBuildTargetPanel({
  targets,
  sourceFiles,
  targetMapping,
  activeTargetFilters,
  onToggleFilter,
  onClearFilters,
  onOpenLog,
  onOpenCreateTarget,
}: FilesBuildTargetPanelProps) {
  const coverageByTarget = useMemo(() => {
    const map = new Map<string, Coverage>();
    if (sourceFiles.length === 0) {
      for (const t of targets) map.set(t.id, { total: 0, uncovered: 0, pct: 0 });
      return map;
    }
    const targetCounts = new Map<string, number>();
    let untargetedCount = 0;
    for (const file of sourceFiles) {
      const mapping = targetMapping[file.relativePath];
      if (mapping?.targetId) {
        targetCounts.set(mapping.targetId, (targetCounts.get(mapping.targetId) ?? 0) + 1);
      } else {
        untargetedCount += 1;
      }
    }
    const totalFiles = sourceFiles.length;
    for (const t of targets) {
      const covered = targetCounts.get(t.id) ?? 0;
      const uncovered = Math.max(0, totalFiles - covered);
      const pct = totalFiles === 0 ? 0 : (covered / totalFiles) * 100;
      map.set(t.id, { total: covered, uncovered, pct });
    }
    map.set(UNTARGETED_KEY, {
      total: untargetedCount,
      uncovered: untargetedCount,
      pct: totalFiles === 0 ? 0 : (untargetedCount / totalFiles) * 100,
    });
    return map;
  }, [sourceFiles, targetMapping, targets]);

  const hasUntargeted = (coverageByTarget.get(UNTARGETED_KEY)?.total ?? 0) > 0;
  const allActive = activeTargetFilters.size === 0;

  return (
    <div className="panel files-build-target-panel">
      <div className="panel-head files-build-target-panel__head">
        <h3 className="panel-title files-build-target-panel__title">
          <HardDrive size={16} />
          빌드 타겟 매핑
          {targets.length > 0 && (
            <span className="files-build-target-panel__title-count">{targets.length}</span>
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
          <>
            <div className="files-target-filter-row" role="group" aria-label="빌드 타겟 필터">
              <button
                type="button"
                className={`files-target-filter-chip${allActive ? " is-active" : ""}`}
                onClick={onClearFilters}
                aria-pressed={allActive}
              >
                All
              </button>
              {targets.map((target) => {
                const isActive = activeTargetFilters.has(target.id);
                return (
                  <button
                    key={target.id}
                    type="button"
                    className={`files-target-filter-chip${isActive ? " is-active" : ""}`}
                    onClick={() => onToggleFilter(target.id)}
                    aria-pressed={isActive}
                  >
                    {target.name}
                  </button>
                );
              })}
              {hasUntargeted && (
                <button
                  type="button"
                  className={`files-target-filter-chip${activeTargetFilters.has(UNTARGETED_KEY) ? " is-active" : ""}`}
                  onClick={() => onToggleFilter(UNTARGETED_KEY)}
                  aria-pressed={activeTargetFilters.has(UNTARGETED_KEY)}
                >
                  Untargeted
                </button>
              )}
            </div>
            <table className="files-target-table">
              <colgroup>
                <col style={{ width: "26%" }} />
                <col style={{ width: "120px" }} />
                <col />
                <col style={{ width: "120px" }} />
                <col style={{ width: "140px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>상태</th>
                  <th>커버리지</th>
                  <th>미커버 파일</th>
                  <th className="files-target-table__action-col" aria-label="액션">액션</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((target) => {
                  const status = target.status ?? "discovered";
                  const cov = coverageByTarget.get(target.id) ?? { total: 0, uncovered: 0, pct: 0 };
                  const actionable = target.status && target.status !== "discovered";
                  const uncovered = cov.uncovered;
                  return (
                    <tr key={target.id}>
                      <td>
                        <div className="files-target-table__name-cell">
                          <span className="files-target-table__stripe" aria-hidden="true" />
                          <span className="files-target-table__name">{target.name}</span>
                        </div>
                      </td>
                      <td>
                        <TargetStatusBadge status={status} size="sm" />
                      </td>
                      <td>
                        <div className="files-target-table__coverage">
                          <div className="files-target-table__bar" aria-hidden="true">
                            <span
                              className="files-target-table__bar-fill"
                              style={{ width: `${Math.min(100, cov.pct)}%` }}
                            />
                          </div>
                          <span className="files-target-table__pct">{cov.pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`files-target-table__uncovered${uncovered > 0 ? " is-warn" : ""}`}
                        >
                          {uncovered}
                        </span>
                      </td>
                      <td className="files-target-table__action-cell">
                        <div className="files-target-table__actions">
                          <button
                            type="button"
                            className="files-target-table__text-action"
                            title="분석 실행"
                          >
                            <Play size={12} />
                            분석
                          </button>
                          {actionable && (
                            <button
                              type="button"
                              className="files-target-table__icon-btn"
                              onClick={() => onOpenLog({ id: target.id, name: target.name })}
                              aria-label="빌드 로그"
                              title="빌드 로그"
                            >
                              <ScrollText size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="files-target-table__icon-btn"
                            aria-label="타겟 편집"
                            title="타겟 편집"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {hasUntargeted && (
                  <tr className="files-target-table__row--untargeted">
                    <td>
                      <div className="files-target-table__name-cell">
                        <span className="files-target-table__stripe" aria-hidden="true" />
                        <span className="files-target-table__name files-target-table__name--muted">
                          Untargeted
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="files-target-table__untargeted-chip">미매핑</span>
                    </td>
                    <td>
                      <div className="files-target-table__coverage">
                        <div className="files-target-table__bar" aria-hidden="true">
                          <span
                            className="files-target-table__bar-fill files-target-table__bar-fill--muted"
                            style={{
                              width: `${Math.min(100, coverageByTarget.get(UNTARGETED_KEY)?.pct ?? 0)}%`,
                            }}
                          />
                        </div>
                        <span className="files-target-table__pct">
                          {(coverageByTarget.get(UNTARGETED_KEY)?.pct ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="files-target-table__uncovered is-warn">
                        {coverageByTarget.get(UNTARGETED_KEY)?.total ?? 0}
                      </span>
                    </td>
                    <td className="files-target-table__action-cell">
                      <span className="files-target-table__action-placeholder" aria-hidden="true">
                        —
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
