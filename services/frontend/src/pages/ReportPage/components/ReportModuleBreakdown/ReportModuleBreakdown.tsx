import "./ReportModuleBreakdown.css";
import React from "react";
import { MODULE_KEY_MAP, type ReportModuleEntry } from "../../reportPresentation";
import { MODULE_META } from "@/common/constants/modules";

interface Props {
  moduleEntries: ReportModuleEntry[];
}

export const ReportModuleBreakdown: React.FC<Props> = ({ moduleEntries }) => {
  if (moduleEntries.length === 0) {
    return <div className="report-empty-line">실행된 모듈이 없습니다.</div>;
  }

  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th>모듈</th>
            <th className="center">탐지</th>
            <th className="center">게이트</th>
            <th className="center">상태</th>
          </tr>
        </thead>
        <tbody>
          {moduleEntries.map(({ key, mod }) => {
            const hasFailedGate = mod.runs.some((run) => run.gate?.status === "fail");
            const passCount = mod.runs.filter((run) => run.gate?.status === "pass").length;
            return (
              <tr key={key}>
                <td>
                  <b>{MODULE_META[MODULE_KEY_MAP[key]]?.label ?? key}</b>{" "}
                  <span className="report-source">· {MODULE_KEY_MAP[key]}</span>
                </td>
                <td className="center mono">{mod.summary.totalFindings}</td>
                <td className="center mono">
                  {passCount}/{mod.runs.length}
                </td>
                <td className="center">
                  <span
                    className={`report-status-tag ${
                      hasFailedGate ? "is-failed" : "is-completed"
                    }`}
                  >
                    {hasFailedGate ? "주의 필요" : "안정"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
