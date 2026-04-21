import React, { useMemo } from "react";
import type { AnalysisResult, EvidenceRef, Finding, GateResult, Run, Severity } from "@aegis/shared";
import { FileCode } from "lucide-react";
import {
  BackButton,
  PageHeader,
  SeverityBadge,
  GateResultCard,
  FindingStatusBadge,
  SourceBadge,
} from "../../../shared/ui";
import { AgentResultPanel } from "./AgentResultPanel";
import { OverviewSectionHeader } from "../../OverviewPage/components/OverviewSectionHeader";
import { parseLocation } from "../../../utils/location";
import { formatDateTime } from "../../../utils/format";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

const POSTURE: Array<{ key: Exclude<Severity, "info">; label: string }> = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

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

  const durationSec =
    run.startedAt && run.endedAt
      ? Math.round((new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
      : null;
  const duration = durationSec != null && durationSec > 0 ? `${durationSec}초` : "—";

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const { finding } of findings) {
      const s = finding.severity as keyof typeof counts;
      if (s in counts) counts[s]++;
    }
    return counts;
  }, [findings]);

  const totalExInfo = findings.length - severityCounts.info;

  return (
    <div className="page-shell run-detail-view">
      <BackButton onClick={onBack} label="대시보드로" />
      <PageHeader title="실행 상세" />

      <section className="run-detail-view__section">
        <OverviewSectionHeader title="실행 정보" />
        <div className="run-detail-view__meta" role="group" aria-label="실행 메타">
          <div className="run-detail-view__meta-cell">
            <span className="run-detail-view__meta-label">STATUS</span>
            <span className="run-detail-view__meta-value">{run.status}</span>
          </div>
          <div className="run-detail-view__meta-cell">
            <span className="run-detail-view__meta-label">DURATION</span>
            <span className="run-detail-view__meta-value">{duration}</span>
          </div>
          <div className="run-detail-view__meta-cell">
            <span className="run-detail-view__meta-label">STARTED</span>
            <span className="run-detail-view__meta-value">
              {run.startedAt ? formatDateTime(run.startedAt) : "—"}
            </span>
          </div>
          <div className="run-detail-view__meta-cell">
            <span className="run-detail-view__meta-label">ENDED</span>
            <span className="run-detail-view__meta-value">
              {run.endedAt ? formatDateTime(run.endedAt) : "—"}
            </span>
          </div>
          {run.analysisResultId && onViewLegacyResult && (
            <div className="run-detail-view__meta-cell">
              <span className="run-detail-view__meta-label">LEGACY RESULT</span>
              <button
                type="button"
                className="run-detail-view__legacy-link"
                onClick={() => onViewLegacyResult(run.analysisResultId)}
              >
                원본 분석 결과 보기
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="run-detail-view__section">
        <OverviewSectionHeader title="보안 현황" />
        <div className="overview-security-posture__grid run-detail-view__severity-grid">
          <Card className="overview-security-posture__card overview-security-posture__card--total">
            <span className="overview-security-posture__eyebrow">총 탐지</span>
            <span className="overview-security-posture__value">{totalExInfo}</span>
            <span className="overview-security-posture__copy">이 실행 누적</span>
          </Card>
          {POSTURE.map((card) => (
            <Card
              key={card.key}
              className={cn(
                "overview-security-posture__card overview-security-posture__card--severity",
                `overview-security-posture__card--${card.key}`,
              )}
            >
              <span
                className={cn(
                  "overview-security-posture__eyebrow",
                  `overview-security-posture__eyebrow--${card.key}`,
                )}
              >
                {card.label}
              </span>
              <span className="overview-security-posture__value">{severityCounts[card.key]}</span>
              <span className="overview-security-posture__copy">건수</span>
            </Card>
          ))}
        </div>
      </section>

      {gate && (
        <section className="run-detail-view__section">
          <OverviewSectionHeader title="품질 게이트" />
          <GateResultCard gate={gate} />
        </section>
      )}

      {analysisResult && (
        <section className="run-detail-view__section">
          <OverviewSectionHeader title="Agent 결과" />
          <AgentResultPanel analysisResult={analysisResult} />
        </section>
      )}

      <section className="run-detail-view__section">
        <OverviewSectionHeader title="탐지 항목" />
        {fileGroups.length === 0 ? (
          <Card className="run-detail-view__empty-card">
            <CardContent className="run-detail-view__empty-body">
              <span className="run-detail-view__empty-eyebrow">CLEAN RUN</span>
              <p className="run-detail-view__empty-copy">이 실행에서는 탐지된 항목이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          fileGroups.map((group) => (
            <Card key={group.fileName} className="run-detail-view__group-card">
              <CardContent className="run-detail-view__group-card-body">
                <div className="run-detail-view__group-head">
                  <FileCode size={14} className="run-detail-view__group-icon" />
                  <span className="run-detail-view__group-file">{group.fileName}</span>
                  <span className="run-detail-view__group-count">{group.items.length} findings</span>
                </div>
                <div className="run-detail-view__group-list">
                  {group.items.map(({ finding }) => {
                    const line = finding.location?.includes(":") ? finding.location.split(":")[1] : null;
                    return (
                      <button
                        key={finding.id}
                        type="button"
                        className="run-detail-view__item"
                        onClick={() => onSelectFinding(finding.id)}
                      >
                        <div className="run-detail-view__item-row">
                          <SeverityBadge severity={finding.severity} size="sm" />
                          <FindingStatusBadge status={finding.status} size="sm" />
                          <SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} />
                          <span className="run-detail-view__item-title">{finding.title}</span>
                          {line && <span className="run-detail-view__item-line">:{line}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
};
