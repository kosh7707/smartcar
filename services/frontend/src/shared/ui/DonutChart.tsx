import React from "react";
import "./DonutChart.css";
import type { AnalysisSummary } from "@aegis/shared";

interface Props {
  summary: AnalysisSummary;
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  centerLabel?: string;
}

const SEGMENTS = [
  { key: "critical" as const, label: "Critical", color: "var(--aegis-severity-critical)" },
  { key: "high" as const, label: "High", color: "var(--aegis-severity-high)" },
  { key: "medium" as const, label: "Medium", color: "var(--aegis-severity-medium)" },
  { key: "low" as const, label: "Low", color: "var(--aegis-severity-low)" },
  { key: "info" as const, label: "Info", color: "var(--aegis-severity-info)" },
];

export const DonutChart: React.FC<Props> = ({ summary, size = 120, strokeWidth = 14, showLegend = true, centerLabel = "Finding" }) => {
  const total = summary.critical + summary.high + summary.medium + summary.low + (summary.info ?? 0);

  const cx = 60;
  const cy = 60;
  const radius = (120 - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = SEGMENTS
    .map((s) => ({ ...s, value: summary[s.key] ?? 0 }))
    .filter((s) => s.value > 0);

  let offset = 0;

  return (
    <div className="donut-chart-container">
      <svg viewBox="0 0 120 120" width={size} height={size}>
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--cds-layer-02)"
          strokeWidth={strokeWidth}
        />
        {/* Segments */}
        {total > 0 && (
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {segments.map((seg) => {
              const segLen = (seg.value / total) * circumference;
              const dashOffset = circumference - segLen;
              const currentOffset = offset;
              offset += segLen;
              return (
                <circle
                  key={seg.key}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                  style={{
                    transform: `rotate(${(currentOffset / circumference) * 360}deg)`,
                    transformOrigin: `${cx}px ${cy}px`,
                    transition: "stroke-dashoffset 600ms ease",
                  }}
                />
              );
            })}
          </g>
        )}
        {/* Center text */}
        <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="700" fill="var(--cds-text-primary)">
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="central" fontSize="14" fill="var(--cds-text-placeholder)">
          {centerLabel}
        </text>
      </svg>
      {showLegend && (
        <div className="donut-chart__legend">
          {segments.map((seg) => (
            <div key={seg.key} className="donut-chart__legend-item">
              <span className="donut-chart__dot" style={{ background: seg.color }} />
              <span className="donut-chart__legend-label">{seg.label}</span>
              <span className="donut-chart__legend-value">{seg.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
