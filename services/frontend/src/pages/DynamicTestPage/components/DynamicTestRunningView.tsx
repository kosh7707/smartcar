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
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <span>데이터 수집 중...</span>
      </div>
    );
  }

  const W = 480,
    H = 180;
  const PAD = { top: 24, right: 16, bottom: 36, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const rawMax = Math.max(
    1,
    ...snapshots.map((s) => Math.max(s.crashes, s.anomalies)),
  );
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
      : [
          0,
          Math.round(niceMax / 4),
          Math.round(niceMax / 2),
          Math.round((niceMax * 3) / 4),
          niceMax,
        ];

  const last = snapshots[snapshots.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {yTicks.map((v) => (
        <line
          key={v}
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(v)}
          y2={y(v)}
          stroke="var(--cds-border-subtle)"
          strokeWidth={0.5}
        />
      ))}
      {yTicks.map((v) => (
        <text
          key={`yl-${v}`}
          x={PAD.left - 8}
          y={y(v)}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize="14"
          fill="var(--cds-text-placeholder)"
        >
          {v}
        </text>
      ))}
      <text
        x={PAD.left}
        y={H - 10}
        fontSize="14"
        fill="var(--cds-text-placeholder)"
      >
        0
      </text>
      <text
        x={W - PAD.right}
        y={H - 10}
        textAnchor="end"
        fontSize="14"
        fill="var(--cds-text-placeholder)"
      >
        {total}
      </text>
      <text
        x={PAD.left + plotW / 2}
        y={H - 10}
        textAnchor="middle"
        fontSize="14"
        fill="var(--cds-text-placeholder)"
      >
        테스트 진행 (iterations)
      </text>
      <path d={toArea("anomalies")} fill="var(--aegis-severity-medium)" opacity={0.08} />
      <path d={toArea("crashes")} fill="var(--cds-support-error)" opacity={0.1} />
      <polyline
        points={toPolyline("anomalies")}
        fill="none"
        stroke="var(--aegis-severity-medium)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <polyline
        points={toPolyline("crashes")}
        fill="none"
        stroke="var(--cds-support-error)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={x(last.step)} cy={y(last.crashes)} r={3.5} fill="var(--cds-support-error)" />
      <circle
        cx={x(last.step)}
        cy={y(last.anomalies)}
        r={3.5}
        fill="var(--aegis-severity-medium)"
      />
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
  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  useEffect(() => {
    setSnapshots((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].step === progress.current)
        return prev;
      return [
        ...prev,
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
    <div className="page-enter space-y-5">
      <PageHeader title="동적 테스트" subtitle="테스트 진행 중..." />

      <div className="stagger mb-5 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
        <StatCard
          label="진행"
          value={`${progress.current} / ${progress.total}`}
          accent
        />
        <StatCard
          label="Crashes"
          value={progress.crashes}
          color="var(--cds-support-error)"
        />
        <StatCard
          label="Anomalies"
          value={progress.anomalies}
          color="var(--aegis-severity-medium)"
        />
        <StatCard label="Findings" value={findings.length} accent />
      </div>

      <Card className="shadow-none">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-4">
            <Progress value={pct} className="h-2 flex-1" />
            <span className="min-w-10 text-right text-sm font-semibold text-primary">
              {pct}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{progress.message}</p>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <CardTitle>실시간 탐지 추이</CardTitle>
            <PerformanceChart snapshots={snapshots} total={progress.total} />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <CardTitle>실시간 Findings ({findings.length})</CardTitle>
            <ScrollArea className="h-[360px] rounded-lg border border-border/70">
              <div className="divide-y divide-border/70" ref={logRef}>
                {findings.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    아직 발견된 이상 없음...
                  </p>
                ) : (
                  findings.map((finding) => (
                    <div key={finding.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <SeverityBadge severity={finding.severity} size="sm" />
                      <span className="flex min-w-20 items-center gap-1.5 font-medium text-foreground">
                        {FINDING_TYPE_ICON[finding.type]}
                        {FINDING_TYPE_LABEL[finding.type]}
                      </span>
                      <code className="max-w-[260px] truncate rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-primary">
                        {finding.input}
                      </code>
                      <span className="truncate text-muted-foreground">
                        {finding.description}
                      </span>
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
