import React from "react";
import { MODULE_KEY_MAP, type ReportModuleEntry } from "../reportPresentation";
import { MODULE_META } from "../../../constants/modules";

export function ReportModuleBreakdown({ moduleEntries }: { moduleEntries: ReportModuleEntry[] }) {
  return (
    <div className="card report-breakdown">
      <div className="card-title">모듈별 분석 현황</div>
      <table className="report-breakdown-table">
        <thead>
          <tr>
            <th>모듈</th>
            <th>탐지 항목</th>
            <th>게이트 통과</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {moduleEntries.map(({ key, mod }) => (
            <tr key={key}>
              <td>
                <span className="report-breakdown__target-name">{MODULE_META[MODULE_KEY_MAP[key]]?.label ?? key}</span>
                <span className="report-breakdown__target-id">{MODULE_KEY_MAP[key]}</span>
              </td>
              <td><span className="report-breakdown__count">{mod.summary.totalFindings}</span></td>
              <td>
                {mod.runs.filter((run) => run.gate?.status === "pass").length}/{mod.runs.length}
              </td>
              <td>
                <span className="report-breakdown__status">
                  {mod.runs.some((run) => run.gate?.status === "fail") ? "주의 필요" : "안정"}
                </span>
              </td>
            </tr>
          ))}
          {moduleEntries.length === 0 && (
            <tr>
              <td colSpan={4} className="report-breakdown__empty">
                해당 모듈 데이터 없음
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
