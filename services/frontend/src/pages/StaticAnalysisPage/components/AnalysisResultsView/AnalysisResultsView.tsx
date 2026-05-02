import "./AnalysisResultsView.css";
import React, { useMemo, useState } from "react";
import type {
  AnalysisResult,
  FileCoverageEntry,
  Severity,
  Vulnerability,
} from "@aegis/shared";
import { ArrowLeft, FileCode, SkipForward } from "lucide-react";
import { cn } from "@/common/utils/cn";
import {
  SeveritySummary,
  SeverityBadge,
} from "@/common/ui/primitives";
import { SEVERITY_ORDER } from "@/common/utils/severity";
import { parseLocation } from "@/common/utils/location";

const SEVERITY_LABEL_SHORT: Record<Severity, string> = {
  critical: "CRIT",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
  info: "INFO",
};

interface FileGroup {
  fileName: string;
  vulns: Array<Vulnerability & { _line?: string }>;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

function groupByFile(vulns: Vulnerability[]): FileGroup[] {
  const map = new Map<string, Array<Vulnerability & { _line?: string }>>();
  for (const vulnerability of vulns) {
    const { fileName, line } = parseLocation(vulnerability.location);
    if (!map.has(fileName)) map.set(fileName, []);
    map.get(fileName)!.push({ ...vulnerability, _line: line });
  }
  const entries = Array.from(map.entries()).sort((a, b) => {
    if (a[0] === "기타") return 1;
    if (b[0] === "기타") return -1;
    return a[0].localeCompare(b[0]);
  });
  return entries.map(([fileName, vulnerabilities]) => ({
    fileName,
    vulns: vulnerabilities,
    summary: {
      critical: vulnerabilities.filter((v) => v.severity === "critical").length,
      high: vulnerabilities.filter((v) => v.severity === "high").length,
      medium: vulnerabilities.filter((v) => v.severity === "medium").length,
      low: vulnerabilities.filter((v) => v.severity === "low").length,
      info: vulnerabilities.filter((v) => v.severity === "info").length,
    },
  }));
}

const FileCoverageSummary: React.FC<{ coverage: FileCoverageEntry[] }> = ({ coverage }) => {
  const analyzed = coverage.filter((entry) => entry.status === "analyzed");
  const skipped = coverage.filter((entry) => entry.status === "skipped");
  const total = coverage.length;
  const pct = total > 0 ? Math.round((analyzed.length / total) * 100) : 0;
  const [showSkipped, setShowSkipped] = useState(false);

  return (
    <div className="panel coverage-card">
      <div className="panel-head">
        <h3>
          파일 커버리지
          <span className="count">
            {analyzed.length}/{total} · {pct}%
          </span>
        </h3>
        {skipped.length > 0 ? (
          <div className="panel-tools">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowSkipped(!showSkipped)}
            >
              {showSkipped ? "접기" : `스킵 ${skipped.length}건 보기`}
            </button>
          </div>
        ) : null}
      </div>
      <div className="panel-body coverage-card__body">
        <div className="coverage-bar" role="img" aria-label={`분석 완료 ${pct}%`}>
          <div className="coverage-bar__fill" style={{ width: `${pct}%` }} />
        </div>
        {showSkipped && skipped.length > 0 ? (
          <ul className="coverage-skipped-list">
            {skipped.map((entry) => (
              <li key={entry.fileId} className="coverage-skipped-item">
                <SkipForward size={12} aria-hidden="true" />
                <span className="coverage-skipped-item__path">{entry.filePath}</span>
                {entry.skipReason ? (
                  <span className="coverage-skipped-item__reason">{entry.skipReason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};

interface Props {
  result: AnalysisResult;
  onSelectVuln: (vulnerability: Vulnerability) => void;
  onNewAnalysis: () => void;
}

const POSTURE: Array<{ key: Exclude<Severity, "info">; label: string }> = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export const AnalysisResultsView: React.FC<Props> = ({ result, onSelectVuln, onNewAnalysis }) => {
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [filterSource, setFilterSource] = useState<"all" | "rule" | "llm">("all");
  const [filterFile, setFilterFile] = useState<string>("all");

  const allFileNames = useMemo(
    () =>
      [...new Set(result.vulnerabilities.map((v) => parseLocation(v.location).fileName))].sort(
        (a, b) => {
          if (a === "기타") return 1;
          if (b === "기타") return -1;
          return a.localeCompare(b);
        },
      ),
    [result.vulnerabilities],
  );

  const filtered = result.vulnerabilities.filter((vulnerability) => {
    if (filterSeverity !== "all" && vulnerability.severity !== filterSeverity) return false;
    if (filterSource !== "all" && vulnerability.source !== filterSource) return false;
    if (filterFile !== "all" && parseLocation(vulnerability.location).fileName !== filterFile) return false;
    return true;
  });

  const fileGroups = useMemo(() => groupByFile(filtered), [filtered]);
  const totalExInfo = result.summary.total - (result.summary.info ?? 0);

  return (
    <div className="page-shell analysis-results-shell" data-chore>
      <header className="page-head chore c-1">
        <div>
          <button type="button" className="back-link" onClick={onNewAnalysis}>
            <ArrowLeft aria-hidden="true" /> 세션 목록으로
          </button>
          <h1>정적 분석 결과</h1>
          <div className="sub">
            <span className="sub-caps">TOTAL</span>
            <b>{totalExInfo}</b>
            <span className="sep" aria-hidden="true">·</span>
            <span className="sub-caps">FILES</span>
            <b>{allFileNames.length}</b>
          </div>
        </div>
      </header>

      <section className="chore c-2" aria-labelledby="results-posture-head">
        <div className="section-head">
          <h2 id="results-posture-head">
            보안 현황
            <span className="count">{totalExInfo}</span>
          </h2>
          <span className="hint">
            {filterSeverity === "all" ? "전체 표시 중" : "심각도 필터 적용"}
          </span>
        </div>
        <div className="severity-tally severity-tally--clickable" role="group">
          <button
            type="button"
            className={cn(
              "severity-tally__cell severity-tally__cell--total",
              filterSeverity === "all" && "is-active",
            )}
            onClick={() => setFilterSeverity("all")}
          >
            <span className="severity-tally__total-label">총 취약점</span>
            <span className="severity-tally__count">{totalExInfo}</span>
          </button>
          {POSTURE.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={cn(
                "severity-tally__cell",
                `severity-tally__cell--${key}`,
                filterSeverity === key && "is-active",
              )}
              onClick={() => setFilterSeverity(filterSeverity === key ? "all" : key)}
            >
              <span className={`sev-chip ${key}`}>
                <span className="sev-dot" aria-hidden="true" />
                {label}
              </span>
              <span className="severity-tally__count">{result.summary[key] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>

      {result.fileCoverage && result.fileCoverage.length > 0 ? (
        <section className="chore c-3" aria-labelledby="coverage-head">
          <div className="section-head">
            <h2 id="coverage-head">분석 커버리지</h2>
          </div>
          <FileCoverageSummary coverage={result.fileCoverage} />
        </section>
      ) : null}

      <section className="chore c-4" aria-labelledby="results-findings-head">
        <div className="section-head">
          <h2 id="results-findings-head">
            탐지 항목
            <span className="count">{filtered.length}</span>
          </h2>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>필터</h3>
            <div className="panel-tools">
              <div className="filter-pills" role="tablist" aria-label="심각도 필터">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterSeverity === "all"}
                  className={cn("pill", filterSeverity === "all" && "active")}
                  onClick={() => setFilterSeverity("all")}
                >
                  ALL
                </button>
                {SEVERITY_ORDER.map((severity) => (
                  <button
                    key={severity}
                    type="button"
                    role="tab"
                    aria-selected={filterSeverity === severity}
                    className={cn("pill", filterSeverity === severity && "active")}
                    onClick={() => setFilterSeverity(severity as Severity)}
                  >
                    <span className={`dot sev-${severity}`} aria-hidden="true" />
                    {SEVERITY_LABEL_SHORT[severity as Severity]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="panel-body panel-body--tools">
            <div className="filter-pills" role="tablist" aria-label="출처 필터">
              <button
                type="button"
                role="tab"
                aria-selected={filterSource === "all"}
                className={cn("pill", filterSource === "all" && "active")}
                onClick={() => setFilterSource("all")}
              >
                ALL
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterSource === "rule"}
                className={cn("pill", filterSource === "rule" && "active")}
                onClick={() => setFilterSource("rule")}
              >
                RULE
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterSource === "llm"}
                className={cn("pill", filterSource === "llm" && "active")}
                onClick={() => setFilterSource("llm")}
              >
                LLM
              </button>
            </div>
            <div className="filter-sort-wrap">
              <span className="sub-caps">FILE</span>
              <select
                className="filter-select"
                value={filterFile}
                onChange={(event) => setFilterFile(event.target.value)}
              >
                <option value="all">전체</option>
                {allFileNames.map((fileName) => (
                  <option key={fileName} value={fileName}>
                    {fileName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {fileGroups.length === 0 ? (
          <div className="panel">
            <div className="panel-empty">
              <span className="panel-empty__eyebrow">NO MATCH</span>
              <p className="panel-empty__copy">현재 필터 조건에 맞는 취약점이 없습니다.</p>
            </div>
          </div>
        ) : (
          <div className="finding-groups">
            {fileGroups.map((group) => (
              <div key={group.fileName} className="panel finding-group">
                <div className="panel-head">
                  <h3>
                    <FileCode aria-hidden="true" />
                    <span className="finding-group__file">{group.fileName}</span>
                    <span className="count">{group.vulns.length}</span>
                  </h3>
                  <div className="panel-tools">
                    <SeveritySummary summary={group.summary} />
                  </div>
                </div>
                <ul className="finding-list">
                  {group.vulns.map((vulnerability) => (
                    <li key={vulnerability.id} className="finding-row">
                      <button
                        type="button"
                        className="finding-row__btn"
                        onClick={() => onSelectVuln(vulnerability)}
                      >
                        <SeverityBadge severity={vulnerability.severity} size="sm" />
                        <span className="finding-row__title">{vulnerability.title}</span>
                        {vulnerability._line ? (
                          <span className="finding-row__line">:{vulnerability._line}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
