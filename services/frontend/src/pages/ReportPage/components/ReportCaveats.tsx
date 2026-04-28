import React from "react";

interface Props {
  caveats: string[];
}

export const ReportCaveats: React.FC<Props> = ({ caveats }) => (
  <div className="report-caveats" aria-label="분석 한계">
    <div className="report-caveats__h">
      심층 분석 중 다음 제약이 기록되었습니다.
    </div>
    <ul>
      {caveats.map((c, i) => (
        <li key={i}>{c}</li>
      ))}
    </ul>
  </div>
);
