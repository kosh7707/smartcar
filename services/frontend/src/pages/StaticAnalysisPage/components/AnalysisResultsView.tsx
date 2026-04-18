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
  for (const v of vulns) {
    const { fileName, line } = parseLocation(v.location);
    if (!map.has(fileName)) map.set(fileName, []);
    map.get(fileName)!.push({ ...v, _line: line });
  }
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

const selectClassName =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const FileCoverageSummary: React.FC<{ coverage: FileCoverageEntry[] }> = ({ coverage }) => {
  const analyzed = coverage.filter((f) => f.status === "analyzed");
  const skipped = coverage.filter((f) => f.status === "skipped");
  const total = coverage.length;
  const pct = total > 0 ? Math.round((analyzed.length / total) * 100) : 0;
  const [showSkipped, setShowSkipped] = useState(false);

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <FileCode size={16} />
          <span className="text-sm font-semibold text-foreground">파일 커버리지</span>
          <span className="ml-auto text-sm font-mono text-muted-foreground">
            {analyzed.length} / {total}개 분석 완료 ({pct}%)
          </span>
          {skipped.length > 0 && (
            <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setShowSkipped(!showSkipped)}>
              {showSkipped ? "접기" : `스킵 ${skipped.length}건 보기`}
            </Button>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border/70">
          <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        {showSkipped && skipped.length > 0 && (
          <div className="space-y-2">
            {skipped.map((f) => (
              <div key={f.fileId} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30">
                <SkipForward size={14} />
                <span className="min-w-0 flex-1 truncate font-mono">{f.filePath}</span>
                {f.skipReason && <span className="shrink-0 text-sm text-muted-foreground">{f.skipReason}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface Props {
  result: AnalysisResult;
  onSelectVuln: (v: Vulnerability) => void;
  onNewAnalysis: () => void;
}

export const AnalysisResultsView: React.FC<Props> = ({ result, onSelectVuln, onNewAnalysis }) => {
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
    <div className="page-enter space-y-5">
      <BackButton onClick={onNewAnalysis} label="세션 목록으로" />
      <PageHeader
        title="정적 분석 결과"
        subtitle="빌드 타겟별 결과와 파일 단위 탐지 현황을 한 작업면에서 검토합니다."
      />

      <div className="analysis-results__summary stagger mb-5 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
        <StatCard label="총 취약점" value={result.summary.total - (result.summary.info ?? 0)} accent />
        <StatCard label="치명" value={result.summary.critical} color="var(--aegis-severity-critical)" />
        <StatCard label="높음" value={result.summary.high} color="var(--aegis-severity-high)" />
        <StatCard label="보통" value={result.summary.medium} color="var(--aegis-severity-medium)" />
        <StatCard label="낮음" value={result.summary.low} color="var(--aegis-severity-low)" />
      </div>

      {result.fileCoverage && result.fileCoverage.length > 0 && <FileCoverageSummary coverage={result.fileCoverage} />}

      <Card className="shadow-none">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm text-muted-foreground">검토 기준</span>
          <select className={selectClassName} value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value as Severity | "all")}>
            <option value="all">심각도 전체</option>
            {SEVERITY_ORDER.map((s) => (
              <option key={s} value={s}>
                {s === "critical" ? "치명" : s === "high" ? "높음" : s === "medium" ? "보통" : s === "low" ? "낮음" : "정보"}
              </option>
            ))}
          </select>
          <select className={selectClassName} value={filterSource} onChange={(e) => setFilterSource(e.target.value as "all" | "rule" | "llm")}>
            <option value="all">출처 전체</option>
            <option value="rule">룰 탐지</option>
            <option value="llm">LLM 검토</option>
          </select>
          <select className={selectClassName} value={filterFile} onChange={(e) => setFilterFile(e.target.value)}>
            <option value="all">파일 전체</option>
            {allFileNames.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {fileGroups.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">필터 조건에 맞는 취약점이 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        fileGroups.map((group) => (
          <Card key={group.fileName} className="overflow-hidden shadow-none">
            <CardContent className="space-y-0 p-0">
              <div className="flex items-center gap-3 border-b border-border/70 bg-background/90 px-5 py-4">
                <FileCode size={16} className="shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-foreground">{group.fileName}</span>
                <span className="shrink-0 font-mono text-sm text-muted-foreground">{group.vulns.length}건</span>
                <SeveritySummary summary={group.summary} />
              </div>
              <div className="divide-y divide-border/70">
                {group.vulns.map((v) => (
                  <button key={v.id} type="button" className="w-full space-y-2 px-5 py-4 text-left transition-colors hover:bg-muted/30" onClick={() => onSelectVuln(v)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={v.severity} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{v.title}</span>
                      {v._line && <span className="shrink-0 font-mono text-sm text-muted-foreground">:{v._line}</span>}
                    </div>
                    <div className="text-sm text-muted-foreground">{v.source === "rule" ? `룰 탐지 (${v.ruleId})` : "LLM 검토"}</div>
                    <div className="text-sm text-muted-foreground">{v.description}</div>
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
