import React from "react";

const SEV_LABELS: Record<string, string> = {
  critical: "치명",
  high: "높음",
  medium: "보통",
  low: "낮음",
};

interface Props {
  sevCounts: { critical: number; high: number; medium: number; low: number };
}

export const ReportSevRow: React.FC<Props> = ({ sevCounts }) => {
  const total =
    sevCounts.critical + sevCounts.high + sevCounts.medium + sevCounts.low;

  if (total === 0) {
    return (
      <div className="report-sev-row" role="group" aria-label="심각도 분포">
        <span className="report-sev-row__lbl">심각도</span>
        <span className="report-sev-row__empty">탐지 없음.</span>
      </div>
    );
  }

  return (
    <div className="report-sev-row" role="group" aria-label="심각도 분포">
      <span className="report-sev-row__lbl">심각도</span>
      {(["critical", "high", "medium", "low"] as const).map((key) => {
        const count = sevCounts[key];
        return (
          <span
            key={key}
            className={`report-sev-row__item is-${key}${count === 0 ? " is-zero" : ""}`}
          >
            <span className="name">{SEV_LABELS[key]}</span>
            <span className="num">{count}</span>
          </span>
        );
      })}
    </div>
  );
};
