import React, { useMemo, useState } from "react";
import type { Run, Finding, FindingStatus, FindingSourceType, EvidenceRef, GateResult, Severity } from "@aegis/shared";
import { FileCode, ShieldAlert, Shield, AlertTriangle, Plus, LayoutList, Layers, CheckSquare } from "lucide-react";
import { StatCard, EmptyState, Spinner, GateResultCard, SeverityBadge, FindingStatusBadge, SourceBadge } from "../ui";
import { TopFilesCard } from "./TopFilesCard";
import { parseLocation } from "../../utils/location";
import { FINDING_STATUS_LABELS, FINDING_STATUS_ORDER, SOURCE_TYPE_LABELS } from "../../constants/finding";

interface FindingWithEvidence {
  finding: Finding;
  evidenceRefs: EvidenceRef[];
}

interface Props {
  runDetail: { run: Run; gate?: GateResult; findings: FindingWithEvidence[] } | null;
  loading: boolean;
  onSelectFinding: (findingId: string) => void;
  onFileClick?: (filePath: string) => void;
  onNewAnalysis: () => void;
}

interface FindingGroup {
  key: string;
  label: string;
  items: FindingWithEvidence[];
}

type GroupBy = "severity" | "file" | "status";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

function groupByFile(findings: FindingWithEvidence[]): FindingGroup[] {
  const map = new Map<string, FindingWithEvidence[]>();
  for (const f of findings) {
    const fileName = parseLocation(f.finding.location).fileName;
    if (!map.has(fileName)) map.set(fileName, []);
    map.get(fileName)!.push(f);
  }
  return Array.from(map.entries())
    .sort((a, b) => {
      if (a[0] === "기타") return 1;
      if (b[0] === "기타") return -1;
      return b[1].length - a[1].length;
    })
    .map(([key, items]) => ({ key, label: key, items }));
}

function groupBySeverity(findings: FindingWithEvidence[]): FindingGroup[] {
  const map = new Map<string, FindingWithEvidence[]>();
  for (const f of findings) {
    const sev = f.finding.severity;
    if (!map.has(sev)) map.set(sev, []);
    map.get(sev)!.push(f);
  }
  return SEVERITY_ORDER
    .filter((s) => map.has(s))
    .map((s) => ({ key: s, label: SEVERITY_LABELS[s], items: map.get(s)! }));
}

function groupByStatus(findings: FindingWithEvidence[]): FindingGroup[] {
  const map = new Map<string, FindingWithEvidence[]>();
  for (const f of findings) {
    const st = f.finding.status;
    if (!map.has(st)) map.set(st, []);
    map.get(st)!.push(f);
  }
  return FINDING_STATUS_ORDER
    .filter((s) => map.has(s))
    .map((s) => ({ key: s, label: FINDING_STATUS_LABELS[s], items: map.get(s)! }));
}

const GROUP_FNS: Record<GroupBy, (f: FindingWithEvidence[]) => FindingGroup[]> = {
  file: groupByFile,
  severity: groupBySeverity,
  status: groupByStatus,
};

export const LatestAnalysisTab: React.FC<Props> = ({
  runDetail,
  loading,
  onSelectFinding,
  onFileClick,
  onNewAnalysis,
}) => {
  if (loading) {
    return (
      <div className="centered-loader--compact">
        <Spinner label="최신 분석 로딩 중..." />
      </div>
    );
  }

  if (!runDetail) {
    return (
      <EmptyState
        icon={<Shield size={32} />}
        title="아직 완료된 분석이 없습니다"
        description="새 분석을 실행하여 코드 보안 상태를 확인하세요."
        action={
          <button className="btn" onClick={onNewAnalysis}>
            <Plus size={16} />
            새 분석
          </button>
        }
      />
    );
  }

  return <LatestAnalysisContent
    runDetail={runDetail}
    onSelectFinding={onSelectFinding}
    onFileClick={onFileClick}
  />;
};

const LatestAnalysisContent: React.FC<{
  runDetail: { run: Run; gate?: GateResult; findings: FindingWithEvidence[] };
  onSelectFinding: (findingId: string) => void;
  onFileClick?: (filePath: string) => void;
}> = ({ runDetail, onSelectFinding, onFileClick }) => {
  const { run, gate, findings } = runDetail;

  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("severity");

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) {
      const s = f.finding.severity as keyof typeof counts;
      if (s in counts) counts[s]++;
    }
    return counts;
  }, [findings]);

  const critHighCount = severityCounts.critical + severityCounts.high;

  const unresolvedCount = useMemo(() => {
    const statuses: FindingStatus[] = ["open", "needs_review", "needs_revalidation", "sandbox"];
    return findings.filter(f => statuses.includes(f.finding.status)).length;
  }, [findings]);

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of findings) {
      const src = f.finding.sourceType;
      counts[src] = (counts[src] || 0) + 1;
    }
    return counts;
  }, [findings]);
  const sourceTotal = Object.values(sourceCounts).reduce((a, b) => a + b, 0);

  const topFiles = useMemo(() => {
    const fileMap = new Map<string, { count: number; topSeverity: Severity }>();
    for (const f of findings) {
      const fileName = parseLocation(f.finding.location).fileName;
      const existing = fileMap.get(fileName);
      const sev = f.finding.severity as Severity;
      if (!existing) {
        fileMap.set(fileName, { count: 1, topSeverity: sev });
      } else {
        existing.count++;
        if (SEVERITY_ORDER.indexOf(sev) < SEVERITY_ORDER.indexOf(existing.topSeverity)) {
          existing.topSeverity = sev;
        }
      }
    }
    return Array.from(fileMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([filePath, { count, topSeverity }]) => ({
        filePath,
        findingCount: count,
        topSeverity,
      }));
  }, [findings]);

  const filteredFindings = useMemo(() => {
    if (severityFilter === "all") return findings;
    return findings.filter((f) => f.finding.severity === severityFilter);
  }, [findings, severityFilter]);

  const groups = useMemo(() => GROUP_FNS[groupBy](filteredFindings), [filteredFindings, groupBy]);

  return (
    <>
      {/* Quality Gate Banner */}
      {gate ? (
        <GateResultCard gate={gate} />
      ) : (
        <p className="text-tertiary text-sm" style={{ marginBottom: "var(--space-4)" }}>
          Quality Gate가 설정되지 않았습니다.
        </p>
      )}

      {/* Run Summary StatCards */}
      <div className="stat-cards stagger">
        <StatCard icon={<Shield size={16} />} label="Finding" value={findings.length} accent />
        <StatCard
          icon={<AlertTriangle size={16} />}
          label="Critical + High"
          value={critHighCount}
          color={critHighCount > 0 ? "var(--severity-high)" : undefined}
        />
        <StatCard icon={<ShieldAlert size={16} />} label="미해결" value={unresolvedCount} color={unresolvedCount > 0 ? "var(--severity-high)" : undefined} />
      </div>

      {/* Source Distribution + Top Files */}
      {findings.length > 0 && (
        <div className="static-dashboard__charts">
          <div className="card chart-card--donut">
            <div className="card-title">출처별 분포</div>
            {sourceTotal === 0 ? (
              <p className="text-tertiary text-sm">데이터 없음</p>
            ) : (
              <div className="source-dist">
                {Object.entries(sourceCounts).map(([key, val]) => (
                  <div key={key} className="source-dist__row">
                    <span className="text-sm source-dist__label">{SOURCE_TYPE_LABELS[key as FindingSourceType] ?? key}</span>
                    <div className="source-dist__bar-track">
                      <div
                        className={`source-dist__bar-fill source-dist__bar-fill--${key}`}
                        style={{ width: `${(val / sourceTotal) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-tertiary">{val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <TopFilesCard topFiles={topFiles} onFileClick={onFileClick} />
        </div>
      )}

      {/* Filter Bar */}
      {findings.length > 0 && (
        <div className="finding-filter-bar">
          <div className="finding-filter-tabs">
            <button
              className={`finding-filter-tab${severityFilter === "all" ? " finding-filter-tab--active" : ""}`}
              onClick={() => setSeverityFilter("all")}
            >
              전체 <span className="finding-filter-count">{findings.length}</span>
            </button>
            {SEVERITY_ORDER.map((sev) => {
              const count = severityCounts[sev];
              if (count === 0) return null;
              return (
                <button
                  key={sev}
                  className={`finding-filter-tab${severityFilter === sev ? " finding-filter-tab--active" : ""}`}
                  onClick={() => setSeverityFilter(sev)}
                >
                  {SEVERITY_LABELS[sev]} <span className="finding-filter-count">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="finding-group-toggle">
            <button
              className={`finding-group-btn${groupBy === "severity" ? " finding-group-btn--active" : ""}`}
              onClick={() => setGroupBy("severity")}
              title="심각도별"
            >
              <Layers size={14} />
            </button>
            <button
              className={`finding-group-btn${groupBy === "file" ? " finding-group-btn--active" : ""}`}
              onClick={() => setGroupBy("file")}
              title="파일별"
            >
              <FileCode size={14} />
            </button>
            <button
              className={`finding-group-btn${groupBy === "status" ? " finding-group-btn--active" : ""}`}
              onClick={() => setGroupBy("status")}
              title="상태별"
            >
              <CheckSquare size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Finding List by Group */}
      {groups.length === 0 ? (
        <div className="card card--empty">
          <p className="text-tertiary">
            {severityFilter === "all" ? "Finding이 없습니다" : `${SEVERITY_LABELS[severityFilter]} Finding이 없습니다`}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="file-group card">
            <div className="file-group__header">
              {groupBy === "file" && <FileCode size={16} className="file-group__icon" />}
              {groupBy === "severity" && <SeverityBadge severity={group.key as Severity} size="sm" />}
              {groupBy === "status" && <FindingStatusBadge status={group.key as FindingStatus} size="sm" />}
              <span className="file-group__name">{group.label}</span>
              <span className="file-group__count">{group.items.length}건</span>
            </div>
            <div className="file-group__body">
              {group.items.map(({ finding }) => {
                const line = finding.location?.includes(":") ? finding.location.split(":")[1] : null;
                return (
                  <div
                    key={finding.id}
                    className="vuln-card"
                    onClick={() => onSelectFinding(finding.id)}
                  >
                    <div className="vuln-card-header">
                      <SeverityBadge severity={finding.severity} size="sm" />
                      <FindingStatusBadge status={finding.status} size="sm" />
                      <SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} />
                      <span className="vuln-title">{finding.title}</span>
                      {line && <span className="file-group__line">:{line}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </>
  );
};
