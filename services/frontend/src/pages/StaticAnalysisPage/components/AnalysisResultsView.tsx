import React, { useState, useMemo } from "react";
import type { AnalysisResult, Vulnerability, Severity, FileCoverageEntry } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { StatCard, PageHeader, BackButton, SeveritySummary } from "../../../shared/ui";
import { FileCode, SkipForward } from "lucide-react";
import { SEVERITY_ORDER } from "../../../utils/severity";
import { parseLocation } from "../../../utils/location";

interface FileGroup {
  fileName: string;
  vulns: Array<Vulnerability & { _line?: string }>;
  summary: { critical: number; high: number; medium: number; low: number; info: number };
}

function groupByFile(vulns: Vulnerability[]): FileGroup[] {
  const map = new Map<string, Array<Vulnerability & { _line?: string }>>();
  for (const v of vulns) {
    const { fileName, line } = parseLocation(v.location);
    if (!map.has(fileName)) map.set(fileName, []);
    map.get(fileName)!.push({ ...v, _line: line });
  }
  // "기타" group last
  const entries = Array.from(map.entries()).sort((a, b) => {
    if (a[0] === "기타") return 1;
    if (b[0] === "기타") return -1;
    return a[0].localeCompare(b[0]);
  });
  return entries.map(([fileName, vs]) => ({
    fileName,
    vulns: vs,
    summary: {
      critical: vs.filter((v) => v.severity === "critical").length,
      high: vs.filter((v) => v.severity === "high").length,
      medium: vs.filter((v) => v.severity === "medium").length,
      low: vs.filter((v) => v.severity === "low").length,
      info: vs.filter((v) => v.severity === "info").length,
    },
  }));
}

/* ── File Coverage Summary ── */

const FileCoverageSummary: React.FC<{ coverage: FileCoverageEntry[] }> = ({ coverage }) => {
  const analyzed = coverage.filter((f) => f.status === "analyzed");
  const skipped = coverage.filter((f) => f.status === "skipped");
  const total = coverage.length;
  const pct = total > 0 ? Math.round((analyzed.length / total) * 100) : 0;
  const [showSkipped, setShowSkipped] = useState(false);

  return (
    <div className="card file-coverage">
      <div className="file-coverage__header">
        <FileCode size={16} />
        <span className="file-coverage__title">파일 커버리지</span>
        <span className="file-coverage__stat">
          {analyzed.length} / {total}개 분석 완료 ({pct}%)
        </span>
        {skipped.length > 0 && (
          <button className="btn-link" onClick={() => setShowSkipped(!showSkipped)}>
            {showSkipped ? "접기" : `스킵 ${skipped.length}건 보기`}
          </button>
        )}
      </div>
      <div className="file-coverage__bar-track">
        <div className="file-coverage__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {showSkipped && skipped.length > 0 && (
        <div className="file-coverage__skipped">
          {skipped.map((f) => (
            <div key={f.fileId} className="file-coverage__skipped-item">
              <SkipForward size={14} />
              <span className="file-coverage__skipped-path">{f.filePath}</span>
              {f.skipReason && <span className="file-coverage__skipped-reason">{f.skipReason}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Component ── */

interface Props {
  result: AnalysisResult;
  onSelectVuln: (v: Vulnerability) => void;
  onNewAnalysis: () => void;
}

export const AnalysisResultsView: React.FC<Props> = ({
  result,
  onSelectVuln,
  onNewAnalysis,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [filterSource, setFilterSource] = useState<"all" | "rule" | "llm">("all");
  const [filterFile, setFilterFile] = useState<string>("all");

  const allFileNames = useMemo(
    () => [...new Set(result.vulnerabilities.map((v) => parseLocation(v.location).fileName))].sort((a, b) => {
      if (a === "기타") return 1;
      if (b === "기타") return -1;
      return a.localeCompare(b);
    }),
    [result.vulnerabilities],
  );

  const filtered = result.vulnerabilities.filter((v) => {
    if (filterSeverity !== "all" && v.severity !== filterSeverity) return false;
    if (filterSource !== "all" && v.source !== filterSource) return false;
    if (filterFile !== "all" && parseLocation(v.location).fileName !== filterFile) return false;
    return true;
  });

  const fileGroups = useMemo(() => groupByFile(filtered), [filtered]);

  return (
    <div className="page-enter analysis-results">
      <BackButton onClick={onNewAnalysis} label="세션 목록으로" />
      <PageHeader title="정적 분석 결과" subtitle="빌드 타겟별 결과와 파일 단위 탐지 현황을 한 작업면에서 검토합니다." />

      {/* Summary */}
      <div className="stat-cards stagger analysis-results__summary">
        <StatCard label="총 취약점" value={result.summary.total - (result.summary.info ?? 0)} accent />
        <StatCard label="치명" value={result.summary.critical} color="var(--aegis-severity-critical)" />
        <StatCard label="높음" value={result.summary.high} color="var(--aegis-severity-high)" />
        <StatCard label="보통" value={result.summary.medium} color="var(--aegis-severity-medium)" />
        <StatCard label="낮음" value={result.summary.low} color="var(--aegis-severity-low)" />
      </div>

      {/* File Coverage */}
      {result.fileCoverage && result.fileCoverage.length > 0 && (
        <FileCoverageSummary coverage={result.fileCoverage} />
      )}

      {/* Filter bar */}
      <div className="static-result-filter analysis-results__filter">
        <span className="text-sm text-secondary">검토 기준</span>
        <select
          className="filter-select"
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as Severity | "all")}
        >
          <option value="all">심각도 전체</option>
          {SEVERITY_ORDER.map((s) => (
            <option key={s} value={s}>
              {s === "critical" ? "치명" : s === "high" ? "높음" : s === "medium" ? "보통" : s === "low" ? "낮음" : "정보"}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value as "all" | "rule" | "llm")}
        >
          <option value="all">출처 전체</option>
          <option value="rule">룰 탐지</option>
          <option value="llm">LLM 검토</option>
        </select>
        <select
          className="filter-select"
          value={filterFile}
          onChange={(e) => setFilterFile(e.target.value)}
        >
          <option value="all">파일 전체</option>
          {allFileNames.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* File-grouped vulnerability list */}
      {fileGroups.length === 0 ? (
        <div className="analysis-results__empty vuln-empty-card">
          <p className="text-tertiary">필터 조건에 맞는 취약점이 없습니다</p>
        </div>
      ) : (
        fileGroups.map((group) => (
          <div key={group.fileName} className="file-group analysis-results__file-group">
            <div className="file-group__header">
              <FileCode size={16} className="file-group__icon" />
              <span className="file-group__name">{group.fileName}</span>
              <span className="file-group__count">{group.vulns.length}건</span>
              <SeveritySummary summary={group.summary} />
            </div>
            <div className="file-group__body vuln-list--animated">
              {group.vulns.map((v) => (
                <div
                  key={v.id}
                  className={`vuln-card vuln-card--${v.severity}`}
                  onClick={() => onSelectVuln(v)}
                >
                  <div className="vuln-card-header">
                    <Badge variant="outline" className={`badge-severity--${v.severity}`}>
                      {v.severity === "critical" ? "치명" : v.severity === "high" ? "높음" : v.severity === "medium" ? "보통" : v.severity === "low" ? "낮음" : "정보"}
                    </Badge>
                    <span className="vuln-title">{v.title}</span>
                    {v._line && <span className="file-group__line">:{v._line}</span>}
                  </div>
                  <div className="vuln-card-meta">
                    <span className="vuln-source">
                      {v.source === "rule" ? `룰 탐지 (${v.ruleId})` : "LLM 검토"}
                    </span>
                  </div>
                  <div className="vuln-card-desc">{v.description}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
