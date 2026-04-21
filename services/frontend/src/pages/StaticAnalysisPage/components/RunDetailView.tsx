import React, { useMemo } from "react";
import type { AnalysisResult, EvidenceRef, Finding, GateResult, Run, Severity } from "@aegis/shared";
import { ArrowLeft, FileCode } from "lucide-react";
import { GateResultCard, FindingStatusBadge, SourceBadge } from "../../../shared/ui";
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

const POSTURE: Array<{ key: Exclude<Severity, "info">; label: string; chipClass: string }> = [
  { key: "critical", label: "Critical", chipClass: "critical" },
  { key: "high", label: "High", chipClass: "high" },
  { key: "medium", label: "Medium", chipClass: "medium" },
  { key: "low", label: "Low", chipClass: "low" },
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

function gateKind(status?: string): "pass" | "warn" | "blocked" | "running" | "none" {
  if (status === "pass") return "pass";
  if (status === "warn") return "warn";
  if (status === "fail" || status === "blocked") return "blocked";
  if (status === "running") return "running";
  return "none";
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
  const duration = durationSec != null && durationSec > 0 ? `${durationSec}s` : "—";

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const { finding } of findings) {
      const s = finding.severity as keyof typeof counts;
      if (s in counts) counts[s]++;
    }
    return counts;
  }, [findings]);

  const totalExInfo = findings.length - severityCounts.info;
  const runGateKind = gateKind(gate?.status);

  return (
    <div className="page-shell run-detail-main" data-chore>
      <header className="page-head chore c-1">
        <div>
          <button type="button" className="back-link" onClick={onBack}>
            <ArrowLeft aria-hidden="true" /> 대시보드로
          </button>
          <h1>
            실행 상세
            <em>
              <span className="run-slug">RUN-{run.id.slice(0, 8)}</span>
            </em>
          </h1>
          <div className="sub">
            <span className={`cell-gate ${runGateKind}`}>
              {gate?.status ? gate.status.toUpperCase() : "NO GATE"}
            </span>
            <span className="sep" aria-hidden="true">·</span>
            <span className="sub-caps">STATUS</span>
            <b>{run.status}</b>
            <span className="sep" aria-hidden="true">·</span>
            <span className="sub-caps">DURATION</span>
            <b>{duration}</b>
            <span className="sep" aria-hidden="true">·</span>
            <span className="sub-caps">STARTED</span>
            <b>{run.startedAt ? formatDateTime(run.startedAt) : "—"}</b>
            <span className="sep" aria-hidden="true">·</span>
            <span className="sub-caps">ENDED</span>
            <b>{run.endedAt ? formatDateTime(run.endedAt) : "—"}</b>
          </div>
        </div>
        {run.analysisResultId && onViewLegacyResult ? (
          <div className="actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onViewLegacyResult(run.analysisResultId!)}
            >
              원본 분석 결과 보기
            </button>
          </div>
        ) : null}
      </header>

      <section className="chore c-2" aria-labelledby="detail-posture-head">
        <div className="section-head">
          <h2 id="detail-posture-head">
            보안 현황
            <span className="count">{totalExInfo}</span>
          </h2>
          <span className="hint">이 실행 누적</span>
        </div>
        <div className="severity-tally severity-tally--row" role="group" aria-label="심각도별 탐지 현황">
          {POSTURE.map(({ key, label, chipClass }) => (
            <div key={key} className={`severity-tally__cell severity-tally__cell--${key}`}>
              <span className={`sev-chip ${chipClass}`}>
                <span className="sev-dot" aria-hidden="true" />
                {label}
              </span>
              <span className="severity-tally__count">{severityCounts[key] ?? 0}</span>
            </div>
          ))}
        </div>
      </section>

      {gate && (
        <section className="chore c-3" aria-labelledby="detail-gate-head">
          <div className="section-head">
            <h2 id="detail-gate-head">품질 게이트</h2>
          </div>
          <GateResultCard gate={gate} />
        </section>
      )}

      {analysisResult && (
        <section className="chore c-4" aria-labelledby="detail-agent-head">
          <div className="section-head">
            <h2 id="detail-agent-head">Agent 결과</h2>
          </div>
          <AgentResultPanel analysisResult={analysisResult} />
        </section>
      )}

      <section className="chore c-5" aria-labelledby="detail-findings-head">
        <div className="section-head">
          <h2 id="detail-findings-head">
            탐지 항목
            <span className="count">{findings.length}</span>
          </h2>
          <span className="hint">FILE 단위 그룹</span>
        </div>

        {fileGroups.length === 0 ? (
          <div className="panel">
            <div className="panel-empty">
              <span className="panel-empty__eyebrow">CLEAN RUN</span>
              <p className="panel-empty__copy">이 실행에서는 탐지된 항목이 없습니다.</p>
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
                    <span className="count">{group.items.length}</span>
                  </h3>
                </div>
                <ul className="finding-list">
                  {group.items.map(({ finding }) => {
                    const line = finding.location?.includes(":")
                      ? finding.location.split(":")[1]
                      : null;
                    return (
                      <li key={finding.id} className="finding-row">
                        <button
                          type="button"
                          className="finding-row__btn"
                          onClick={() => onSelectFinding(finding.id)}
                        >
                          <span className={`sev-chip ${finding.severity}`}>
                            <span className="sev-dot" aria-hidden="true" />
                            {finding.severity.toUpperCase()}
                          </span>
                          <FindingStatusBadge status={finding.status} size="sm" />
                          <SourceBadge
                            sourceType={finding.sourceType}
                            ruleId={finding.ruleId}
                          />
                          <span className="finding-row__title">{finding.title}</span>
                          {line ? <span className="finding-row__line">:{line}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
