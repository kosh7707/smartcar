import React from "react";
import type { AnalysisSummary } from "@aegis/shared";

interface Props {
  summary: AnalysisSummary;
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  centerLabel?: string;
}

const SEGMENTS = [
  { key: "critical" as const, label: "Critical", color: "var(--severity-critical)" },
  { key: "high" as const, label: "High", color: "var(--severity-high)" },
  { key: "medium" as const, label: "Medium", color: "var(--severity-medium)" },
  { key: "low" as const, label: "Low", color: "var(--severity-low)" },
  { key: "info" as const, label: "Info", color: "var(--severity-info)" },
];

export const DonutChart: React.FC<Props> = ({
  summary,
  size = 120,
  strokeWidth = 14,
  showLegend = true,
  centerLabel = "Finding",
}) => {
  const total = summary.critical + summary.high + summary.medium + summary.low + (summary.info ?? 0);

  const cx = 60;
  const cy = 60;
  const radius = (120 - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = SEGMENTS
    .map((segment) => ({ ...segment, value: summary[segment.key] ?? 0 }))
    .filter((segment) => segment.value > 0);

  let offset = 0;

  return (
    <div className="donut-chart">
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth={strokeWidth}
        />
        {total > 0 ? (
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {segments.map((segment) => {
              const segmentLength = (segment.value / total) * circumference;
              const dashOffset = circumference - segmentLength;
              const currentOffset = offset;
              offset += segmentLength;

              return (
                <circle
                  key={segment.key}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                  className="donut-chart__segment"
                  style={{
                    transform: `rotate(${(currentOffset / circumference) * 360}deg)`,
                    transformOrigin: `${cx}px ${cy}px`,
                  }}
                />
              );
            })}
          </g>
        ) : null}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="central"
          className="donut-chart__value"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          dominantBaseline="central"
          className="donut-chart__label"
        >
          {centerLabel}
        </text>
      </svg>
      {showLegend ? (
        <div className="donut-chart__legend">
          {segments.map((segment) => (
            <div key={segment.key} className="donut-chart__legend-item">
              <span className="donut-chart__legend-dot" style={{ background: segment.color }} />
              <span className="donut-chart__legend-label">{segment.label}</span>
              <span className="donut-chart__legend-value">{segment.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
