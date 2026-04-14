import React, { useEffect, useRef, useState } from "react";
import type { DynamicTestFinding } from "@aegis/shared";
import { AlertTriangle, Bug, Clock } from "lucide-react";
import { PageHeader, SeverityBadge, StatCard } from "../../../shared/ui";
import type { TestProgress } from "../../../hooks/useDynamicTest";
import { FINDING_TYPE_ICON, FINDING_TYPE_LABEL } from "../dynamicTestPresentation";

interface ChartSnapshot {
  step: number;
  crashes: number;
  anomalies: number;
}

const PerformanceChart: React.FC<{ snapshots: ChartSnapshot[]; total: number }> = ({ snapshots, total }) => {
  if (snapshots.length < 2) {
    return (
      <div className="dtest-chart-empty">
        <span>데이터 수집 중...</span>
      </div>
    );
  }

  const W = 480, H = 180;
  const PAD = { top: 24, right: 16, bottom: 36, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const rawMax = Math.max(1, ...snapshots.map((s) => Math.max(s.crashes, s.anomalies)));
  const niceMax = rawMax <= 5 ? rawMax : Math.ceil(rawMax / 5) * 5;

  const x = (step: number) => PAD.left + (step / Math.max(total, 1)) * plotW;
  const y = (val: number) => PAD.top + plotH - (val / niceMax) * plotH;

  const toPolyline = (key: "crashes" | "anomalies") =>
    snapshots.map((s) => `${x(s.step)},${y(s[key])}`).join(" ");

  const toArea = (key: "crashes" | "anomalies") => {
    const base = y(0);
    return (
      `M${x(snapshots[0].step)},${base} ` +
      snapshots.map((s) => `L${x(s.step)},${y(s[key])}`).join(" ") +
      ` L${x(snapshots[snapshots.length - 1].step)},${base} Z`
    );
  };

  const yTicks =
    niceMax <= 5
      ? Array.from({ length: niceMax + 1 }, (_, i) => i)
      : [0, Math.round(niceMax / 4), Math.round(niceMax / 2), Math.round((niceMax * 3) / 4), niceMax];

  const last = snapshots[snapshots.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dtest-chart">
      {yTicks.map((v) => (
        <line key={v} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--cds-border-subtle)" strokeWidth={0.5} />
      ))}
      {yTicks.map((v) => (
        <text key={`yl-${v}`} x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="14" fill="var(--cds-text-placeholder)">
          {v}
        </text>
      ))}
      <text x={PAD.left} y={H - 10} fontSize="14" fill="var(--cds-text-placeholder)">0</text>
      <text x={W - PAD.right} y={H - 10} textAnchor="end" fontSize="14" fill="var(--cds-text-placeholder)">{total}</text>
      <text x={PAD.left + plotW / 2} y={H - 10} textAnchor="middle" fontSize="14" fill="var(--cds-text-placeholder)">테스트 진행 (iterations)</text>
      <path d={toArea("anomalies")} fill="var(--aegis-severity-medium)" opacity={0.08} />
      <path d={toArea("crashes")} fill="var(--cds-support-error)" opacity={0.1} />
      <polyline points={toPolyline("anomalies")} fill="none" stroke="var(--aegis-severity-medium)" strokeWidth={2} strokeLinejoin="round" />
      <polyline points={toPolyline("crashes")} fill="none" stroke="var(--cds-support-error)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={x(last.step)} cy={y(last.crashes)} r={3.5} fill="var(--cds-support-error)" />
      <circle cx={x(last.step)} cy={y(last.anomalies)} r={3.5} fill="var(--aegis-severity-medium)" />
    </svg>
  );
};

interface DynamicTestRunningViewProps {
  progress: TestProgress;
  findings: DynamicTestFinding[];
}

export const DynamicTestRunningView: React.FC<DynamicTestRunningViewProps> = ({ progress, findings }) => {
  const logRef = useRef<HTMLDivElement>(null);
  const [snapshots, setSnapshots] = useState<ChartSnapshot[]>([]);
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  useEffect(() => {
    setSnapshots((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].step === progress.current) return prev;
      return [...prev, { step: progress.current, crashes: progress.crashes, anomalies: progress.anomalies }];
    });
  }, [progress.current, progress.crashes, progress.anomalies]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [findings.length]);

  return (
    <div className="page-enter">
      <PageHeader title="동적 테스트" subtitle="테스트 진행 중..." />

      <div className="stat-cards stagger">
        <StatCard label="진행" value={`${progress.current} / ${progress.total}`} accent />
        <StatCard label="Crashes" value={progress.crashes} color="var(--cds-support-error)" />
        <StatCard label="Anomalies" value={progress.anomalies} color="var(--aegis-severity-medium)" />
        <StatCard label="Findings" value={findings.length} accent />
      </div>

      <div className="card dtest-running-bar">
        <div className="dtest-running__bar-wrap">
          <div className="dtest-running__bar-track">
            <div className="dtest-running__bar-fill shimmer-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="dtest-running__pct">{pct}%</span>
        </div>
        <p className="dtest-running__message">{progress.message}</p>
      </div>

      <div className="dtest-running-grid">
        <div className="card">
          <div className="card-title">실시간 탐지 추이</div>
          <PerformanceChart snapshots={snapshots} total={progress.total} />
        </div>

        <div className="card">
          <div className="card-title">실시간 Findings ({findings.length})</div>
          <div className="dtest-findings-log" ref={logRef}>
            {findings.length === 0 ? (
              <p className="dtest-findings-log__empty">아직 발견된 이상 없음...</p>
            ) : (
              findings.map((finding) => (
                <div key={finding.id} className="dtest-finding-row animate-fade-in">
                  <SeverityBadge severity={finding.severity} size="sm" />
                  <span className="dtest-finding-row__type">
                    {FINDING_TYPE_ICON[finding.type]}
                    {FINDING_TYPE_LABEL[finding.type]}
                  </span>
                  <code className="dtest-finding-row__input">{finding.input}</code>
                  <span className="dtest-finding-row__desc">{finding.description}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
