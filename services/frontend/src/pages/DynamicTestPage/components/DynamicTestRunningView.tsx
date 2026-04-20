import React, { useEffect, useRef, useState } from "react";
import type { DynamicTestFinding } from "@aegis/shared";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader, SeverityBadge, StatCard } from "../../../shared/ui";
import type { TestProgress } from "../../../hooks/useDynamicTest";
import {
  FINDING_TYPE_ICON,
  FINDING_TYPE_LABEL,
} from "../dynamicTestPresentation";

interface ChartSnapshot {
  step: number;
  crashes: number;
  anomalies: number;
}

const PerformanceChart: React.FC<{
  snapshots: ChartSnapshot[];
  total: number;
}> = ({ snapshots, total }) => {
  if (snapshots.length < 2) {
    return (
      <div className="dynamic-test-running-chart-empty">
        <span>데이터 수집 중...</span>
      </div>
    );
  }

  const W = 480;
  const H = 180;
  const PAD = { top: 24, right: 16, bottom: 36, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const rawMax = Math.max(1, ...snapshots.map((snapshot) => Math.max(snapshot.crashes, snapshot.anomalies)));
  const niceMax = rawMax <= 5 ? rawMax : Math.ceil(rawMax / 5) * 5;

  const x = (step: number) => PAD.left + (step / Math.max(total, 1)) * plotW;
  const y = (val: number) => PAD.top + plotH - (val / niceMax) * plotH;

  const toPolyline = (key: "crashes" | "anomalies") => snapshots.map((snapshot) => `${x(snapshot.step)},${y(snapshot[key])}`).join(" ");

  const toArea = (key: "crashes" | "anomalies") => {
    const base = y(0);
    return (
      `M${x(snapshots[0].step)},${base} ` +
      snapshots.map((snapshot) => `L${x(snapshot.step)},${y(snapshot[key])}`).join(" ") +
      ` L${x(snapshots[snapshots.length - 1].step)},${base} Z`
    );
  };

  const yTicks =
    niceMax <= 5
      ? Array.from({ length: niceMax + 1 }, (_, index) => index)
      : [0, Math.round(niceMax / 4), Math.round(niceMax / 2), Math.round((niceMax * 3) / 4), niceMax];

  const last = snapshots[snapshots.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dynamic-test-running-chart-svg">
      {yTicks.map((value) => (
        <line
          key={value}
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(value)}
          y2={y(value)}
          className="dynamic-test-running-chart-guide"
        />
      ))}
      {yTicks.map((value) => (
        <text
          key={`yl-${value}`}
          x={PAD.left - 8}
          y={y(value)}
          textAnchor="end"
          dominantBaseline="middle"
          className="dynamic-test-running-chart-axis"
        >
          {value}
        </text>
      ))}
      <text x={PAD.left} y={H - 10} className="dynamic-test-running-chart-axis">
        0
      </text>
      <text x={W - PAD.right} y={H - 10} textAnchor="end" className="dynamic-test-running-chart-axis">
        {total}
      </text>
      <text
        x={PAD.left + plotW / 2}
        y={H - 10}
        textAnchor="middle"
        className="dynamic-test-running-chart-axis"
      >
        테스트 진행 (iterations)
      </text>
      <path d={toArea("anomalies")} className="dynamic-test-running-chart-area dynamic-test-running-chart-area--anomalies" />
      <path d={toArea("crashes")} className="dynamic-test-running-chart-area dynamic-test-running-chart-area--crashes" />
      <polyline points={toPolyline("anomalies")} fill="none" className="dynamic-test-running-chart-line dynamic-test-running-chart-line--anomalies" />
      <polyline points={toPolyline("crashes")} fill="none" className="dynamic-test-running-chart-line dynamic-test-running-chart-line--crashes" />
      <circle cx={x(last.step)} cy={y(last.crashes)} r={3.5} className="dynamic-test-running-chart-dot dynamic-test-running-chart-dot--crashes" />
      <circle cx={x(last.step)} cy={y(last.anomalies)} r={3.5} className="dynamic-test-running-chart-dot dynamic-test-running-chart-dot--anomalies" />
    </svg>
  );
};

interface DynamicTestRunningViewProps {
  progress: TestProgress;
  findings: DynamicTestFinding[];
}

export const DynamicTestRunningView: React.FC<DynamicTestRunningViewProps> = ({
  progress,
  findings,
}) => {
  const logRef = useRef<HTMLDivElement>(null);
  const [snapshots, setSnapshots] = useState<ChartSnapshot[]>([]);
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  useEffect(() => {
    setSnapshots((previous) => {
      if (previous.length > 0 && previous[previous.length - 1].step === progress.current) return previous;
      return [
        ...previous,
        {
          step: progress.current,
          crashes: progress.crashes,
          anomalies: progress.anomalies,
        },
      ];
    });
  }, [progress.current, progress.crashes, progress.anomalies]);

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [findings.length]);

  return (
    <div className="page-shell dynamic-test-running-shell">
      <PageHeader title="동적 테스트" subtitle="테스트 진행 중..." />

      <div className="dynamic-test-running-stats">
        <StatCard label="진행" value={`${progress.current} / ${progress.total}`} accent />
        <StatCard label="Crashes" value={progress.crashes} color="var(--cds-support-error)" />
        <StatCard label="Anomalies" value={progress.anomalies} color="var(--aegis-severity-medium)" />
        <StatCard label="Findings" value={findings.length} accent />
      </div>

      <Card className="dynamic-test-running-progress-card">
        <CardContent className="dynamic-test-running-progress-body">
          <div className="dynamic-test-running-progress-row">
            <Progress value={pct} className="dynamic-test-running-progress-bar" />
            <span className="dynamic-test-running-progress-value">{pct}%</span>
          </div>
          <p className="dynamic-test-running-progress-copy">{progress.message}</p>
        </CardContent>
      </Card>

      <div className="dynamic-test-running-grid">
        <Card className="dynamic-test-running-card">
          <CardContent className="dynamic-test-running-card-body">
            <CardTitle>실시간 탐지 추이</CardTitle>
            <PerformanceChart snapshots={snapshots} total={progress.total} />
          </CardContent>
        </Card>

        <Card className="dynamic-test-running-card">
          <CardContent className="dynamic-test-running-card-body">
            <CardTitle>실시간 Findings ({findings.length})</CardTitle>
            <ScrollArea className="dynamic-test-running-log-scroll">
              <div className="dynamic-test-running-log" ref={logRef}>
                {findings.length === 0 ? (
                  <p className="dynamic-test-running-empty">아직 발견된 이상 없음...</p>
                ) : (
                  findings.map((finding) => (
                    <div key={finding.id} className="dynamic-test-running-log-item">
                      <SeverityBadge severity={finding.severity} size="sm" />
                      <span className="dynamic-test-running-log-type">
                        {FINDING_TYPE_ICON[finding.type]}
                        {FINDING_TYPE_LABEL[finding.type]}
                      </span>
                      <code className="dynamic-test-running-log-code">{finding.input}</code>
                      <span className="dynamic-test-running-log-description">{finding.description}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
