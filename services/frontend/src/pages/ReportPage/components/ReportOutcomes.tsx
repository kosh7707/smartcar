import React from "react";
import type { AnalysisResult } from "@aegis/shared";
import { deriveCleanPass } from "@/shared/analysis/deepOutcome";

interface Props {
  deepResult: AnalysisResult;
}

export const ReportOutcomes: React.FC<Props> = ({ deepResult }) => {
  const cleanPass = deriveCleanPass(deepResult);

  return (
    <div className="report-outcomes" aria-label="심층 분석 결과">
      <span className={`report-outcome ${cleanPass ? "is-ok" : "is-warn"}`}>
        <span className="lbl">Clean pass</span>
        <span className="v">{cleanPass ? "예" : "아니오"}</span>
      </span>
      {deepResult.qualityOutcome ? (
        <span
          className={`report-outcome ${deepResult.qualityOutcome === "accepted" ? "is-ok" : "is-warn"}`}
        >
          <span className="lbl">Quality</span>
          <span className="v">{deepResult.qualityOutcome}</span>
        </span>
      ) : null}
      {deepResult.analysisOutcome ? (
        <span className="report-outcome">
          <span className="lbl">Analysis</span>
          <span className="v">{deepResult.analysisOutcome}</span>
        </span>
      ) : null}
      {deepResult.pocOutcome && deepResult.pocOutcome !== "poc_not_requested" ? (
        <span className="report-outcome">
          <span className="lbl">PoC</span>
          <span className="v">{deepResult.pocOutcome}</span>
        </span>
      ) : null}
    </div>
  );
};
