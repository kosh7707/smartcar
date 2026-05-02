import "./FilesManifestInsights.css";
import React, { useMemo } from "react";
import { Activity, FileCode2, Flame, Target } from "lucide-react";
import type { Severity } from "@aegis/shared";
import type { SourceFileEntry, TargetMappingEntry } from "@/common/api/client";
import type { useBuildTargets } from "@/common/hooks/useBuildTargets";
import { LANG_GROUPS } from "@/common/constants/languages";
import { formatFileSize } from "@/common/utils/format";

const UNTARGETED_KEY = "__untargeted__";
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];
const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};
const SEVERITY_VAR: Record<Severity, string> = {
  critical: "var(--severity-critical)",
  high: "var(--severity-high)",
  medium: "var(--severity-medium)",
  low: "var(--severity-low)",
  info: "var(--severity-info, var(--foreground-subtle))",
};

interface FilesManifestInsightsProps {
  sourceFiles: SourceFileEntry[];
  targetMapping: Record<string, TargetMappingEntry>;
  targets: ReturnType<typeof useBuildTargets>["targets"];
  findingsByFile: Map<string, { total: number; topSeverity: Severity }>;
  composition: Record<string, { count: number; bytes: number }>;
  onSelectFile: (path: string) => void;
}

export const FilesManifestInsights: React.FC<FilesManifestInsightsProps> = ({
  sourceFiles,
  targetMapping,
  targets,
  findingsByFile,
  composition,
  onSelectFile,
}) => {
  const totalFiles = sourceFiles.length;

  const coverageRows = useMemo(() => {
    const counts = new Map<string, number>();
    let untargeted = 0;
    for (const file of sourceFiles) {
      const m = targetMapping[file.relativePath];
      if (m?.targetId) counts.set(m.targetId, (counts.get(m.targetId) ?? 0) + 1);
      else untargeted += 1;
    }
    const rows = targets.map((t) => ({
      key: t.id,
      label: t.name,
      count: counts.get(t.id) ?? 0,
      muted: false,
    }));
    if (untargeted > 0) {
      rows.push({ key: UNTARGETED_KEY, label: "Untargeted", count: untargeted, muted: true });
    }
    return rows;
  }, [sourceFiles, targetMapping, targets]);

  const findingsByTarget = useMemo(() => {
    const matrix = new Map<string, Record<Severity, number>>();
    for (const t of targets) {
      matrix.set(t.id, { critical: 0, high: 0, medium: 0, low: 0, info: 0 });
    }
    matrix.set(UNTARGETED_KEY, { critical: 0, high: 0, medium: 0, low: 0, info: 0 });
    for (const [fileName, info] of findingsByFile) {
      const mapping = targetMapping[fileName];
      const key = mapping?.targetId ?? UNTARGETED_KEY;
      const bucket = matrix.get(key);
      if (!bucket) continue;
      bucket[info.topSeverity] += info.total;
    }
    const rows: Array<{ key: string; label: string; counts: Record<Severity, number>; total: number }> = [];
    for (const t of targets) {
      const counts = matrix.get(t.id);
      if (!counts) continue;
      const total = SEVERITIES.reduce((s, sev) => s + counts[sev], 0);
      if (total > 0) rows.push({ key: t.id, label: t.name, counts, total });
    }
    const utc = matrix.get(UNTARGETED_KEY);
    if (utc) {
      const total = SEVERITIES.reduce((s, sev) => s + utc[sev], 0);
      if (total > 0) rows.push({ key: UNTARGETED_KEY, label: "Untargeted", counts: utc, total });
    }
    return rows;
  }, [findingsByFile, targetMapping, targets]);

  const compositionRows = useMemo(() => {
    const groups = new Map<string, { bytes: number; color: string }>();
    const fromComposition = Object.entries(composition);
    if (fromComposition.length > 0) {
      for (const [language, { bytes }] of fromComposition) {
        const info = LANG_GROUPS[language];
        const group = info?.group ?? "Other";
        const color = info?.color ?? "var(--foreground-subtle)";
        const prev = groups.get(group);
        if (prev) prev.bytes += bytes;
        else groups.set(group, { bytes, color });
      }
    } else {
      for (const file of sourceFiles) {
        const info = LANG_GROUPS[file.language];
        const group = info?.group ?? "Other";
        const color = info?.color ?? "var(--foreground-subtle)";
        const prev = groups.get(group);
        const bytes = file.size || 0;
        if (prev) prev.bytes += bytes;
        else groups.set(group, { bytes, color });
      }
    }
    const all = Array.from(groups.entries()).map(([group, v]) => ({
      group,
      bytes: v.bytes,
      color: v.color,
    }));
    const totalBytes = all.reduce((s, r) => s + r.bytes, 0);
    return { rows: all.sort((a, b) => b.bytes - a.bytes), totalBytes };
  }, [composition, sourceFiles]);

  const hotspots = useMemo(() => {
    const rows: Array<{ path: string; total: number; topSeverity: Severity; targetName?: string }> = [];
    for (const [path, info] of findingsByFile) {
      const mapping = targetMapping[path];
      rows.push({ path, total: info.total, topSeverity: info.topSeverity, targetName: mapping?.targetName });
    }
    rows.sort((a, b) => b.total - a.total);
    return rows.slice(0, 5);
  }, [findingsByFile, targetMapping]);

  const hasTargets = targets.length > 0;
  const hasFindings = findingsByFile.size > 0;

  return (
    <div className="files-insights" aria-label="Manifest Insights">
      <section className="files-insights__section">
        <header className="files-insights__head">
          <Target size={14} className="files-insights__head-icon" />
          <h4 className="files-insights__title">1. 빌드 타겟 커버리지</h4>
          <span className="files-insights__count">{coverageRows.reduce((s, r) => s + r.count, 0)} / {totalFiles} files</span>
        </header>
        <div className="files-insights__body">
          {!hasTargets ? (
            <div className="files-insights__empty">
              <p>아직 빌드 타겟이 없습니다.</p>
              <p className="files-insights__empty-sub">빌드 타겟을 생성하면 커버리지가 여기에 표시됩니다.</p>
            </div>
          ) : (
            <ul className="files-insights__bars">
              {coverageRows.map((row) => {
                const pct = totalFiles === 0 ? 0 : (row.count / totalFiles) * 100;
                return (
                  <li
                    key={row.key}
                    className={`files-insights__bar-row${row.muted ? " is-muted" : ""}`}
                  >
                    <span className="files-insights__bar-label" title={row.label}>{row.label}</span>
                    <span className="files-insights__bar-track" aria-hidden="true">
                      <span
                        className={`files-insights__bar-fill${row.muted ? " is-muted" : ""}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </span>
                    <span className="files-insights__bar-count">{row.count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="files-insights__section">
        <header className="files-insights__head">
          <Activity size={14} className="files-insights__head-icon" />
          <h4 className="files-insights__title">2. 취약점 분포 by 빌드 타겟</h4>
        </header>
        <div className="files-insights__body">
          {!hasFindings ? (
            <div className="files-insights__empty">
              <p>아직 finding 이 없습니다.</p>
              <p className="files-insights__empty-sub">분석 실행 후 매핑별 finding 분포가 여기에 표시됩니다.</p>
            </div>
          ) : (
            <>
              <ul className="files-insights__stacks">
                {findingsByTarget.map((row) => (
                  <li key={row.key} className="files-insights__stack-row">
                    <span className="files-insights__stack-label" title={row.label}>{row.label}</span>
                    <span className="files-insights__stack-track" aria-hidden="true">
                      {SEVERITIES.map((sev) =>
                        row.counts[sev] > 0 ? (
                          <span
                            key={sev}
                            className="files-insights__stack-seg"
                            style={{
                              flex: row.counts[sev],
                              background: SEVERITY_VAR[sev],
                            }}
                          />
                        ) : null,
                      )}
                    </span>
                    <span className="files-insights__stack-count">{row.total}</span>
                  </li>
                ))}
              </ul>
              <div className="files-insights__legend">
                {SEVERITIES.map((sev) => (
                  <span key={sev} className="files-insights__legend-item">
                    <span
                      className="files-insights__legend-dot"
                      style={{ background: SEVERITY_VAR[sev] }}
                      aria-hidden="true"
                    />
                    {SEVERITY_LABEL[sev]}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="files-insights__section">
        <header className="files-insights__head">
          <FileCode2 size={14} className="files-insights__head-icon" />
          <h4 className="files-insights__title">3. 언어 구성 (composition)</h4>
          <span className="files-insights__count">{formatFileSize(compositionRows.totalBytes)}</span>
        </header>
        <div className="files-insights__body">
          {compositionRows.rows.length === 0 ? (
            <div className="files-insights__empty">
              <p>표시할 언어가 없습니다.</p>
            </div>
          ) : (
            <ul className="files-insights__bars">
              {compositionRows.rows.map((row) => {
                const pct = compositionRows.totalBytes === 0
                  ? 0
                  : (row.bytes / compositionRows.totalBytes) * 100;
                return (
                  <li key={row.group} className="files-insights__bar-row">
                    <span className="files-insights__bar-label" title={row.group}>{row.group}</span>
                    <span className="files-insights__bar-track" aria-hidden="true">
                      <span
                        className="files-insights__bar-fill"
                        style={{ width: `${Math.min(100, pct)}%`, background: row.color }}
                      />
                    </span>
                    <span className="files-insights__bar-count">{pct.toFixed(1)}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="files-insights__section">
        <header className="files-insights__head">
          <Flame size={14} className="files-insights__head-icon" />
          <h4 className="files-insights__title">4. Top hotspot files</h4>
        </header>
        <div className="files-insights__body">
          {!hasFindings ? (
            <div className="files-insights__empty">
              <p>아직 finding 이 없습니다.</p>
              <p className="files-insights__empty-sub">분석 실행 후 위험이 몰린 파일이 여기에 표시됩니다.</p>
            </div>
          ) : (
            <ul className="files-insights__hotspots">
              {hotspots.map((row) => (
                <li key={row.path} className="files-insights__hotspot-row">
                  <button
                    type="button"
                    className="files-insights__hotspot-btn"
                    onClick={() => onSelectFile(row.path)}
                    title={row.path}
                  >
                    <span
                      className="files-insights__hotspot-dot"
                      style={{ background: SEVERITY_VAR[row.topSeverity] }}
                      aria-hidden="true"
                    />
                    <span className="files-insights__hotspot-path">{row.path}</span>
                    {row.targetName ? (
                      <span className="files-insights__hotspot-target">{row.targetName}</span>
                    ) : null}
                    <span className="files-insights__hotspot-count">{row.total}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
