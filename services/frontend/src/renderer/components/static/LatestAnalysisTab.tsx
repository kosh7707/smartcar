import React, { useMemo } from "react";
import type { Run, Finding, EvidenceRef, GateResult, Severity } from "@smartcar/shared";
import { FileCode, Clock, Shield, AlertTriangle, Plus } from "lucide-react";
import { StatCard, DonutChart, EmptyState, Spinner, GateResultCard, SeverityBadge, FindingStatusBadge, SourceBadge } from "../ui";
import { TopFilesCard } from "./TopFilesCard";
import { parseLocation } from "../../utils/location";

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

interface FileGroup {
  fileName: string;
  items: FindingWithEvidence[];
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function groupFindingsByFile(findings: FindingWithEvidence[]): FileGroup[] {
  const map = new Map<string, FindingWithEvidence[]>();
  for (const f of findings) {
    const loc = f.finding.location ?? "기타";
    const fileName = parseLocation(loc).fileName;
    if (!map.has(fileName)) map.set(fileName, []);
    map.get(fileName)!.push(f);
  }
  return Array.from(map.entries())
    .sort((a, b) => {
      if (a[0] === "기타") return 1;
      if (b[0] === "기타") return -1;
      return b[1].length - a[1].length;
    })
    .map(([fileName, items]) => ({ fileName, items }));
}

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

  const fileGroups = useMemo(() => groupFindingsByFile(findings), [findings]);

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) {
      const s = f.finding.severity as keyof typeof counts;
      if (s in counts) counts[s]++;
    }
    return counts;
  }, [findings]);

  const severitySummary = useMemo(() => ({
    total: findings.length,
    ...severityCounts,
  }), [findings.length, severityCounts]);

  const critHighCount = severityCounts.critical + severityCounts.high;

  const durationSec = run.startedAt && run.endedAt
    ? Math.round((new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null;
  const duration = durationSec != null && durationSec > 0 ? `${durationSec}초` : "—";

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
        <StatCard icon={<Clock size={16} />} label="소요 시간" value={duration} />
      </div>

      {/* Severity Distribution */}
      {findings.length > 0 && (
        <div className="static-dashboard__charts">
          <div className="card chart-card--donut">
            <div className="card-title">심각도 분포</div>
            <DonutChart summary={severitySummary} size={140} />
          </div>
          <TopFilesCard topFiles={topFiles} onFileClick={onFileClick} />
        </div>
      )}

      {/* Finding List by File */}
      {fileGroups.length === 0 ? (
        <div className="card card--empty">
          <p className="text-tertiary">Finding이 없습니다</p>
        </div>
      ) : (
        fileGroups.map((group) => (
          <div key={group.fileName} className="file-group card">
            <div className="file-group__header">
              <FileCode size={16} className="file-group__icon" />
              <span className="file-group__name">{group.fileName}</span>
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
