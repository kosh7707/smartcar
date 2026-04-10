import React, { useMemo } from "react";
import type { Run, Finding, EvidenceRef, GateResult, AnalysisResult } from "@aegis/shared";
import { FileCode, Clock, PlayCircle } from "lucide-react";
import { BackButton, PageHeader, StatCard, SeverityBadge, GateResultCard, FindingStatusBadge, ConfidenceBadge, SourceBadge } from "../../../shared/ui";
import { AgentResultPanel } from "./AgentResultPanel";
import { parseLocation } from "../../../utils/location";
import { formatDateTime } from "../../../utils/format";

interface FindingWithEvidence {
  finding: Finding;
  evidenceRefs: EvidenceRef[];
}

interface Props {
  runDetail: {
    run: Run;
    gate?: GateResult;
    findings: FindingWithEvidence[];
  };
  analysisResult?: AnalysisResult | null;
  projectId: string;
  onBack: () => void;
  onSelectFinding: (findingId: string) => void;
  onViewLegacyResult?: (analysisResultId: string) => void;
}

interface FileGroup {
  fileName: string;
  items: FindingWithEvidence[];
}

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
      return a[0].localeCompare(b[0]);
    })
    .map(([fileName, items]) => ({ fileName, items }));
}

export const RunDetailView: React.FC<Props> = ({
  runDetail,
  analysisResult,
  onBack,
  onSelectFinding,
  onViewLegacyResult,
}) => {
  const { run, gate, findings } = runDetail;
  const fileGroups = useMemo(() => groupFindingsByFile(findings), [findings]);

  const durationSec = run.startedAt && run.endedAt
    ? Math.round((new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null;
  const duration = durationSec != null && durationSec > 0 ? `${durationSec}초` : "—";

  return (
    <div className="page-enter">
      <BackButton onClick={onBack} label="대시보드로" />
      <PageHeader title="Run 상세" icon={<PlayCircle size={20} />} />

      {/* Run metadata */}
      <div className="stat-cards stagger">
        <StatCard icon={<PlayCircle size={16} />} label="상태" value={run.status} />
        <StatCard icon={<FileCode size={16} />} label="Finding" value={run.findingCount} accent />
        <StatCard icon={<Clock size={16} />} label="소요 시간" value={duration} />
      </div>

      <div className="text-xs text-tertiary run-meta-text">
        시작: {run.startedAt ? formatDateTime(run.startedAt) : "—"} | 종료: {run.endedAt ? formatDateTime(run.endedAt) : "—"}
        {run.analysisResultId && onViewLegacyResult && (
          <>
            {" | "}
            <button
              className="btn-link text-xs"
              onClick={() => onViewLegacyResult(run.analysisResultId)}
            >
              원본 분석 결과 보기
            </button>
          </>
        )}
      </div>

      {/* Gate result */}
      {gate && <GateResultCard gate={gate} />}

      {/* Agent analysis metadata */}
      {analysisResult && <AgentResultPanel analysisResult={analysisResult} />}

      {/* Finding list by file */}
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
    </div>
  );
};
