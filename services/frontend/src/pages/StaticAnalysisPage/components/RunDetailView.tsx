import React, { useMemo } from "react";
import type { AnalysisResult, EvidenceRef, Finding, GateResult, Run } from "@aegis/shared";
import { FileCode } from "lucide-react";
import {
  BackButton,
  PageHeader,
  StatCard,
  SeverityBadge,
  GateResultCard,
  FindingStatusBadge,
  SourceBadge,
} from "../../../shared/ui";
import { AgentResultPanel } from "./AgentResultPanel";
import { parseLocation } from "../../../utils/location";
import { formatDateTime } from "../../../utils/format";
import { Card, CardContent } from "@/components/ui/card";

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

  const durationSec =
    run.startedAt && run.endedAt
      ? Math.round((new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
      : null;
  const duration = durationSec != null && durationSec > 0 ? `${durationSec}초` : "—";

  return (
    <div className="page-enter space-y-5">
      <BackButton onClick={onBack} label="대시보드로" />
      <PageHeader title="실행 상세" subtitle="실행 상태, 게이트 판정, 파일별 탐지 항목을 한 흐름에서 검토합니다." />

      <div className="stagger mb-5 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
        <StatCard label="상태" value={run.status} />
        <StatCard label="탐지 항목" value={run.findingCount} accent />
        <StatCard label="소요 시간" value={duration} />
      </div>

      <div className="text-sm text-muted-foreground">
        시작: {run.startedAt ? formatDateTime(run.startedAt) : "—"} | 종료: {run.endedAt ? formatDateTime(run.endedAt) : "—"}
        {run.analysisResultId && onViewLegacyResult && (
          <>
            {" | "}
            <button className="text-primary underline-offset-4 hover:underline" onClick={() => onViewLegacyResult(run.analysisResultId)}>
              원본 분석 결과 보기
            </button>
          </>
        )}
      </div>

      {gate && <GateResultCard gate={gate} />}
      {analysisResult && <AgentResultPanel analysisResult={analysisResult} />}

      {fileGroups.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">탐지 항목이 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        fileGroups.map((group) => (
          <Card key={group.fileName} className="overflow-hidden shadow-none">
            <CardContent className="space-y-0 p-0">
              <div className="flex items-center gap-3 border-b border-border/70 bg-background/90 px-5 py-4">
                <FileCode size={16} className="shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-foreground">{group.fileName}</span>
                <span className="shrink-0 font-mono text-sm text-muted-foreground">{group.items.length}건</span>
              </div>
              <div className="divide-y divide-border/70">
                {group.items.map(({ finding }) => {
                  const line = finding.location?.includes(":") ? finding.location.split(":")[1] : null;
                  return (
                    <button key={finding.id} type="button" className="w-full px-5 py-4 text-left transition-colors hover:bg-muted/30" onClick={() => onSelectFinding(finding.id)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={finding.severity} size="sm" />
                        <FindingStatusBadge status={finding.status} size="sm" />
                        <SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{finding.title}</span>
                        {line && <span className="shrink-0 font-mono text-sm text-muted-foreground">:{line}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
