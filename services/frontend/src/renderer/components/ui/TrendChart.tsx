import React from "react";
import { EmptyState } from "./EmptyState";
import { BarChart3 } from "lucide-react";

export interface TrendPoint {
  date: string;
  runCount: number;
  findingCount: number;
  gatePassCount: number;
}

interface Props {
  data: TrendPoint[];
  height?: number;
}

export const TrendChart: React.FC<Props> = ({ data, height = 200 }) => {
  if (data.length === 0) {
    return <EmptyState compact icon={<BarChart3 size={20} />} title="트렌드 데이터 없음" />;
  }

  if (data.length < 2) {
    return (
      <div className="trend-chart" style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--text-tertiary)" }}>
        <BarChart3 size={24} style={{ marginBottom: "var(--space-2)", opacity: 0.5 }} />
        <p style={{ fontSize: "var(--text-sm)", margin: 0 }}>
          트렌드를 보려면 2회 이상 분석이 필요합니다. 현재 {data.length}회 완료.
        </p>
      </div>
    );
  }

  const pad = { top: 20, right: 16, bottom: 32, left: 40 };
  const w = 600;
  const h = height;
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const maxFinding = Math.max(...data.map((d) => d.findingCount), 1);
  const maxGate = Math.max(...data.map((d) => d.gatePassCount), 1);
  const maxY = Math.max(maxFinding, maxGate);

  const barWidth = Math.max(4, Math.min(24, (innerW / data.length) * 0.6));
  const gap = innerW / data.length;

  const linePoints = data
    .map((d, i) => {
      const x = pad.left + i * gap + gap / 2;
      const y = pad.top + innerH - (d.gatePassCount / maxY) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  // Show ~5 labels max
  const labelStep = Math.max(1, Math.floor(data.length / 5));

  return (
    <div className="trend-chart">
      <div className="trend-chart__legend">
        <span className="trend-chart__legend-item">
          <span className="trend-chart__dot" style={{ background: "var(--accent)" }} />
          Finding 수
        </span>
        <span className="trend-chart__legend-item">
          <span className="trend-chart__dot trend-chart__dot--line" style={{ background: "var(--success)" }} />
          Gate 통과
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" width="100%" style={{ maxHeight: h }}>
        {/* Y-axis guides */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = pad.top + innerH - frac * innerH;
          return (
            <g key={frac}>
              <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="var(--border-subtle)" strokeWidth={0.5} />
              <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">
                {Math.round(frac * maxY)}
              </text>
            </g>
          );
        })}

        {/* Bars (findingCount) */}
        {data.map((d, i) => {
          const x = pad.left + i * gap + gap / 2 - barWidth / 2;
          const barH = (d.findingCount / maxY) * innerH;
          return (
            <rect
              key={`bar-${i}`}
              x={x}
              y={pad.top + innerH - barH}
              width={barWidth}
              height={barH}
              rx={2}
              fill="var(--accent)"
              opacity={0.7}
            />
          );
        })}

        {/* Line (gatePassCount) */}
        {data.length > 1 && (
          <polyline
            points={linePoints}
            fill="none"
            stroke="var(--success)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Line dots */}
        {data.map((d, i) => {
          const x = pad.left + i * gap + gap / 2;
          const y = pad.top + innerH - (d.gatePassCount / maxY) * innerH;
          return <circle key={`dot-${i}`} cx={x} cy={y} r={3} fill="var(--success)" />;
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          if (i % labelStep !== 0 && i !== data.length - 1) return null;
          const x = pad.left + i * gap + gap / 2;
          const label = d.date.slice(5); // "MM-DD"
          return (
            <text key={`label-${i}`} x={x} y={h - 6} textAnchor="middle" fontSize={9} fill="var(--text-tertiary)">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
