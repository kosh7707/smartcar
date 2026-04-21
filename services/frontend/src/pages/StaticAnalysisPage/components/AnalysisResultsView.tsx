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
  SeverityBadge,
} from "../../../shared/ui";
import { cn } from "@/lib/utils";
import { FileCode, SkipForward } from "lucide-react";
import { SEVERITY_ORDER } from "../../../utils/severity";
import { parseLocation } from "../../../utils/location";
import { OverviewSectionHeader } from "../../OverviewPage/components/OverviewSectionHeader";

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
          <span className="analysis-results-coverage-label">FILE COVERAGE</span>
          <span className="analysis-results-coverage-count">
            {analyzed.length} / {total} · {pct}%
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
        <div className="analysis-results-coverage-bar" role="img" aria-label={`분석 완료 ${pct}%`}>
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

  const POSTURE: Array<{ key: Exclude<Severity, "info">; label: string }> = [
    { key: "critical", label: "Critical" },
    { key: "high", label: "High" },
    { key: "medium", label: "Medium" },
    { key: "low", label: "Low" },
  ];
  const totalExInfo = result.summary.total - (result.summary.info ?? 0);

  return (
    <div className="analysis-results-shell">
      <BackButton onClick={onNewAnalysis} label="세션 목록으로" />
      <PageHeader title="정적 분석 결과" />

      <section className="analysis-results-section">
        <OverviewSectionHeader title="보안 현황" />
        <div className="overview-security-posture__grid analysis-results-severity-grid">
          <Card
            className={cn(
              "overview-security-posture__card overview-security-posture__card--total",
              filterSeverity === "all" && "is-active",
            )}
            onClick={() => setFilterSeverity("all")}
          >
            <span className="overview-security-posture__eyebrow">총 취약점</span>
            <span className="overview-security-posture__value">{totalExInfo}</span>
            <span className="overview-security-posture__copy">
              {filterSeverity === "all" ? "전체 표시 중" : "전체 보기"}
            </span>
          </Card>
          {POSTURE.map((card) => (
            <Card
              key={card.key}
              className={cn(
                "overview-security-posture__card overview-security-posture__card--severity",
                `overview-security-posture__card--${card.key}`,
                filterSeverity === card.key && "is-active",
              )}
              onClick={() => setFilterSeverity(filterSeverity === card.key ? "all" : card.key)}
            >
              <span
                className={cn(
                  "overview-security-posture__eyebrow",
                  `overview-security-posture__eyebrow--${card.key}`,
                )}
              >
                {card.label}
              </span>
              <span className="overview-security-posture__value">
                {result.summary[card.key] ?? 0}
              </span>
              <span className="overview-security-posture__copy">
                {filterSeverity === card.key ? "필터 해제" : "해당 심각도만"}
              </span>
            </Card>
          ))}
        </div>
      </section>

      {result.fileCoverage && result.fileCoverage.length > 0 ? (
        <section className="analysis-results-section">
          <OverviewSectionHeader title="분석 커버리지" />
          <FileCoverageSummary coverage={result.fileCoverage} />
        </section>
      ) : null}

      <section className="analysis-results-section">
        <OverviewSectionHeader title="탐지 항목" />
        <Card className="analysis-results-card">
        <CardContent className="analysis-results-filter-bar">
          <div className="analysis-results-filter-group">
            <span className="analysis-results-filter-label">SEVERITY</span>
            <div className="filter-pills" role="tablist" aria-label="심각도 필터">
              <button
                type="button"
                role="tab"
                aria-selected={filterSeverity === "all"}
                className={`pill${filterSeverity === "all" ? " active" : ""}`}
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
                  className={`pill${filterSeverity === severity ? " active" : ""}`}
                  onClick={() => setFilterSeverity(severity as Severity)}
                >
                  <span className={`dot sev-${severity}`} aria-hidden="true" />
                  {SEVERITY_LABEL_SHORT[severity as Severity]}
                </button>
              ))}
            </div>
          </div>

          <div className="analysis-results-filter-group">
            <span className="analysis-results-filter-label">SOURCE</span>
            <div className="filter-pills" role="tablist" aria-label="출처 필터">
              <button
                type="button"
                role="tab"
                aria-selected={filterSource === "all"}
                className={`pill${filterSource === "all" ? " active" : ""}`}
                onClick={() => setFilterSource("all")}
              >
                ALL
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterSource === "rule"}
                className={`pill${filterSource === "rule" ? " active" : ""}`}
                onClick={() => setFilterSource("rule")}
              >
                RULE
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterSource === "llm"}
                className={`pill${filterSource === "llm" ? " active" : ""}`}
                onClick={() => setFilterSource("llm")}
              >
                LLM
              </button>
            </div>
          </div>

          <div className="analysis-results-filter-group analysis-results-filter-group--file">
            <span className="analysis-results-filter-label">FILE</span>
            <select
              className="analysis-results-select"
              value={filterFile}
              onChange={(event) => setFilterFile(event.target.value)}
            >
              <option value="all">전체 파일</option>
              {allFileNames.map((fileName) => (
                <option key={fileName} value={fileName}>
                  {fileName}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {fileGroups.length === 0 ? (
        <Card className="analysis-results-card">
          <CardContent className="analysis-results-empty-body">
            <span className="analysis-results-empty-eyebrow">NO MATCH</span>
            <p className="analysis-results-empty-copy">현재 필터 조건에 맞는 취약점이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        fileGroups.map((group) => (
          <Card key={group.fileName} className="analysis-results-group-card">
            <CardContent className="analysis-results-group-body">
              <div className="analysis-results-group-head">
                <FileCode size={14} className="analysis-results-group-icon" />
                <span className="analysis-results-group-file">{group.fileName}</span>
                <span className="analysis-results-group-count">{group.vulns.length} findings</span>
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
                        ? `룰 탐지 · ${vulnerability.ruleId}`
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
      </section>
    </div>
  );
};
