import React, { useMemo } from "react";
import { HardDrive, Pencil, Play, Plus, ScrollText } from "lucide-react";
import type { useBuildTargets } from "../../../hooks/useBuildTargets";
import { TargetStatusBadge } from "../../../shared/ui";
import type { SourceFileEntry, TargetMappingEntry } from "../../../api/client";

const UNTARGETED_KEY = "__untargeted__";

type StatusTone = "ready" | "failed" | "building" | "discovered";

const TONE_BY_STATUS: Record<string, StatusTone> = {
  ready: "ready",
  built: "ready",
  success: "ready",
  failed: "failed",
  error: "failed",
  building: "building",
  queued: "building",
  pending: "building",
  running: "building",
  discovered: "discovered",
};

function toneFor(status: string): StatusTone {
  return TONE_BY_STATUS[status.toLowerCase()] ?? "discovered";
}

interface TargetCoverage {
  covered: number;
  outside: number;
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
  const { coverageByTarget, totals } = useMemo(() => {
    const totalFiles = sourceFiles.length;
    const counts = new Map<string, number>();
    let untargetedCount = 0;
    for (const file of sourceFiles) {
      const mapping = targetMapping[file.relativePath];
      if (mapping?.targetId) {
        counts.set(mapping.targetId, (counts.get(mapping.targetId) ?? 0) + 1);
      } else {
        untargetedCount += 1;
      }
    }
    const map = new Map<string, TargetCoverage>();
    for (const t of targets) {
      const covered = counts.get(t.id) ?? 0;
      const outside = Math.max(0, totalFiles - covered);
      const pct = totalFiles === 0 ? 0 : (covered / totalFiles) * 100;
      map.set(t.id, { covered, outside, pct });
    }
    map.set(UNTARGETED_KEY, {
      covered: untargetedCount,
      outside: Math.max(0, totalFiles - untargetedCount),
      pct: totalFiles === 0 ? 0 : (untargetedCount / totalFiles) * 100,
    });
    const targetedCount = totalFiles - untargetedCount;
    const totalCoveragePct = totalFiles === 0 ? 0 : (targetedCount / totalFiles) * 100;
    return {
      coverageByTarget: map,
      totals: {
        totalFiles,
        targetedCount,
        untargetedCount,
        totalCoveragePct,
      },
    };
  }, [sourceFiles, targetMapping, targets]);

  const hasUntargeted = totals.untargetedCount > 0;
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
            <div className="files-targets-summary" aria-label="전체 매핑 요약">
              <div className="files-targets-summary__metric files-targets-summary__metric--lead">
                <span className="files-targets-summary__pct">
                  {totals.totalCoveragePct.toFixed(1)}
                  <span className="files-targets-summary__pct-unit">%</span>
                </span>
                <span className="files-targets-summary__label">전체 커버리지</span>
                <div className="files-targets-summary__lead-bar" aria-hidden="true">
                  <span
                    className="files-targets-summary__lead-bar-fill"
                    style={{ width: `${Math.min(100, totals.totalCoveragePct)}%` }}
                  />
                </div>
              </div>
              <div className="files-targets-summary__divider" aria-hidden="true" />
              <div className="files-targets-summary__metric">
                <span className="files-targets-summary__count">{totals.targetedCount}</span>
                <span className="files-targets-summary__label">covered files</span>
              </div>
              <div className="files-targets-summary__divider" aria-hidden="true" />
              <div className="files-targets-summary__metric">
                <span
                  className={`files-targets-summary__count${
                    totals.untargetedCount > 0 ? " is-warn" : ""
                  }`}
                >
                  {totals.untargetedCount}
                </span>
                <span className="files-targets-summary__label">untargeted</span>
              </div>
              <div className="files-targets-summary__divider" aria-hidden="true" />
              <div className="files-targets-summary__metric">
                <span className="files-targets-summary__count">{targets.length}</span>
                <span className="files-targets-summary__label">build targets</span>
              </div>
            </div>

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

            <ul className="files-target-cards" aria-label="빌드 타겟 목록">
              {targets.map((target) => {
                const status = target.status ?? "discovered";
                const tone = toneFor(status);
                const cov = coverageByTarget.get(target.id) ?? { covered: 0, outside: 0, pct: 0 };
                const actionable = target.status && target.status !== "discovered";
                return (
                  <li key={target.id} className="files-target-card" data-tone={tone}>
                    <span className="files-target-card__stripe" aria-hidden="true" />
                    <div className="files-target-card__body">
                      <div className="files-target-card__row">
                        <div className="files-target-card__heading">
                          <span className="files-target-card__name" title={target.name}>
                            {target.name}
                          </span>
                          <TargetStatusBadge status={status} size="sm" />
                        </div>
                        <div className="files-target-card__pct">
                          <span className="files-target-card__pct-value">
                            {cov.pct.toFixed(1)}
                          </span>
                          <span className="files-target-card__pct-unit">%</span>
                        </div>
                      </div>
                      <div className="files-target-card__bar" aria-hidden="true">
                        <span
                          className="files-target-card__bar-fill"
                          style={{ width: `${Math.min(100, cov.pct)}%` }}
                        />
                      </div>
                      <div className="files-target-card__meta">
                        <span className="files-target-card__meta-stat">
                          <strong>{cov.covered}</strong>
                          <span className="files-target-card__meta-divider">/</span>
                          <span>{totals.totalFiles} files</span>
                        </span>
                        <span
                          className={`files-target-card__meta-uncovered${
                            cov.outside > 0 ? " is-warn" : ""
                          }`}
                        >
                          {cov.outside} uncovered
                        </span>
                        <div className="files-target-card__actions">
                          <button
                            type="button"
                            className="files-target-card__primary-action"
                            title="분석 실행"
                          >
                            <Play size={12} />
                            분석
                          </button>
                          {actionable && (
                            <button
                              type="button"
                              className="files-target-card__icon-btn"
                              onClick={() => onOpenLog({ id: target.id, name: target.name })}
                              aria-label="빌드 로그"
                              title="빌드 로그"
                            >
                              <ScrollText size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="files-target-card__icon-btn"
                            aria-label="타겟 편집"
                            title="타겟 편집"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
              {hasUntargeted && (
                <li className="files-target-card files-target-card--untargeted" data-tone="untargeted">
                  <span className="files-target-card__stripe" aria-hidden="true" />
                  <div className="files-target-card__body">
                    <div className="files-target-card__row">
                      <div className="files-target-card__heading">
                        <span className="files-target-card__name files-target-card__name--muted">
                          Untargeted
                        </span>
                        <span className="files-target-card__untargeted-tag">미매핑</span>
                      </div>
                      <div className="files-target-card__pct files-target-card__pct--muted">
                        <span className="files-target-card__pct-value">
                          {(coverageByTarget.get(UNTARGETED_KEY)?.pct ?? 0).toFixed(1)}
                        </span>
                        <span className="files-target-card__pct-unit">%</span>
                      </div>
                    </div>
                    <div className="files-target-card__bar" aria-hidden="true">
                      <span
                        className="files-target-card__bar-fill files-target-card__bar-fill--muted"
                        style={{
                          width: `${Math.min(100, coverageByTarget.get(UNTARGETED_KEY)?.pct ?? 0)}%`,
                        }}
                      />
                    </div>
                    <div className="files-target-card__meta">
                      <span className="files-target-card__meta-stat">
                        <strong>{totals.untargetedCount}</strong>
                        <span className="files-target-card__meta-divider">/</span>
                        <span>{totals.totalFiles} files</span>
                      </span>
                      <span className="files-target-card__meta-help">
                        어떤 빌드 타겟에도 속하지 않는 파일
                      </span>
                    </div>
                  </div>
                </li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
