import React, { useMemo, useState } from "react";
import type {
  AnalysisResult,
  FileCoverageEntry,
  Severity,
  Vulnerability,
} from "@aegis/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BackButton,
  PageHeader,
  SeveritySummary,
  StatCard,
} from "../../../shared/ui";
import { FileCode, SkipForward } from "lucide-react";
import { SEVERITY_ORDER } from "../../../utils/severity";
import { parseLocation } from "../../../utils/location";

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
      critical: vulnerabilities.filter((vulnerability) => vulnerability.severity === "critical").length,
      high: vulnerabilities.filter((vulnerability) => vulnerability.severity === "high").length,
      medium: vulnerabilities.filter((vulnerability) => vulnerability.severity === "medium").length,
      low: vulnerabilities.filter((vulnerability) => vulnerability.severity === "low").length,
      info: vulnerabilities.filter((vulnerability) => vulnerability.severity === "info").length,
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
    <Card className="analysis-results-card">
      <CardContent className="analysis-results-coverage-body">
        <div className="analysis-results-coverage-head">
          <div className="analysis-results-coverage-title-wrap">
            <FileCode size={16} />
            <span className="analysis-results-coverage-title">파일 커버리지</span>
          </div>
          <span className="analysis-results-coverage-count">
            {analyzed.length} / {total}개 분석 완료 ({pct}%)
          </span>
          {skipped.length > 0 ? (
            <Button
              variant="link"
              size="sm"
              className="analysis-results-link-button"
              onClick={() => setShowSkipped(!showSkipped)}
            >
              {showSkipped ? "접기" : `스킵 ${skipped.length}건 보기`}
            </Button>
          ) : null}
        </div>
        <div className="analysis-results-coverage-bar">
          <div
            className="analysis-results-coverage-bar-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        {showSkipped && skipped.length > 0 ? (
          <div className="analysis-results-skipped-list">
            {skipped.map((entry) => (
              <div key={entry.fileId} className="analysis-results-skipped-item">
                <SkipForward size={14} />
                <span className="analysis-results-skipped-path">{entry.filePath}</span>
                {entry.skipReason ? (
                  <span className="analysis-results-skipped-reason">{entry.skipReason}</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

interface Props {
  result: AnalysisResult;
  onSelectVuln: (vulnerability: Vulnerability) => void;
  onNewAnalysis: () => void;
}

export const AnalysisResultsView: React.FC<Props> = ({ result, onSelectVuln, onNewAnalysis }) => {
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [filterSource, setFilterSource] = useState<"all" | "rule" | "llm">("all");
  const [filterFile, setFilterFile] = useState<string>("all");

  const allFileNames = useMemo(
    () =>
      [...new Set(result.vulnerabilities.map((vulnerability) => parseLocation(vulnerability.location).fileName))].sort(
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

  return (
    <div className="analysis-results-shell">
      <BackButton onClick={onNewAnalysis} label="세션 목록으로" />
      <PageHeader title="정적 분석 결과" />

      <div className="analysis-results-summary-grid">
        <StatCard label="총 취약점" value={result.summary.total - (result.summary.info ?? 0)} accent />
        <StatCard label="치명" value={result.summary.critical} color="var(--aegis-severity-critical)" />
        <StatCard label="높음" value={result.summary.high} color="var(--aegis-severity-high)" />
        <StatCard label="보통" value={result.summary.medium} color="var(--aegis-severity-medium)" />
        <StatCard label="낮음" value={result.summary.low} color="var(--aegis-severity-low)" />
      </div>

      {result.fileCoverage && result.fileCoverage.length > 0 ? (
        <FileCoverageSummary coverage={result.fileCoverage} />
      ) : null}

      <Card className="analysis-results-card">
        <CardContent className="analysis-results-filter-bar">
          <span className="analysis-results-filter-label">검토 기준</span>
          <select
            className="analysis-results-select"
            value={filterSeverity}
            onChange={(event) => setFilterSeverity(event.target.value as Severity | "all")}
          >
            <option value="all">심각도 전체</option>
            {SEVERITY_ORDER.map((severity) => (
              <option key={severity} value={severity}>
                {severity === "critical"
                  ? "치명"
                  : severity === "high"
                    ? "높음"
                    : severity === "medium"
                      ? "보통"
                      : severity === "low"
                        ? "낮음"
                        : "정보"}
              </option>
            ))}
          </select>
          <select
            className="analysis-results-select"
            value={filterSource}
            onChange={(event) => setFilterSource(event.target.value as "all" | "rule" | "llm")}
          >
            <option value="all">출처 전체</option>
            <option value="rule">룰 탐지</option>
            <option value="llm">LLM 검토</option>
          </select>
          <select
            className="analysis-results-select analysis-results-select--wide"
            value={filterFile}
            onChange={(event) => setFilterFile(event.target.value)}
          >
            <option value="all">파일 전체</option>
            {allFileNames.map((fileName) => (
              <option key={fileName} value={fileName}>
                {fileName}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {fileGroups.length === 0 ? (
        <Card className="analysis-results-card">
          <CardContent className="analysis-results-empty-body">
            <p className="analysis-results-empty-copy">필터 조건에 맞는 취약점이 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        fileGroups.map((group) => (
          <Card key={group.fileName} className="analysis-results-group-card">
            <CardContent className="analysis-results-group-body">
              <div className="analysis-results-group-head">
                <FileCode size={16} className="analysis-results-group-icon" />
                <span className="analysis-results-group-file">{group.fileName}</span>
                <span className="analysis-results-group-count">{group.vulns.length}건</span>
                <SeveritySummary summary={group.summary} />
              </div>
              <div className="analysis-results-group-list">
                {group.vulns.map((vulnerability) => (
                  <button
                    key={vulnerability.id}
                    type="button"
                    className="analysis-results-item"
                    onClick={() => onSelectVuln(vulnerability)}
                  >
                    <div className="analysis-results-item-row">
                      <SeverityBadge severity={vulnerability.severity} size="sm" />
                      <span className="analysis-results-item-title">{vulnerability.title}</span>
                      {vulnerability._line ? (
                        <span className="analysis-results-item-line">:{vulnerability._line}</span>
                      ) : null}
                    </div>
                    <div className="analysis-results-item-source">
                      {vulnerability.source === "rule"
                        ? `룰 탐지 (${vulnerability.ruleId})`
                        : "LLM 검토"}
                    </div>
                    <div className="analysis-results-item-description">{vulnerability.description}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
