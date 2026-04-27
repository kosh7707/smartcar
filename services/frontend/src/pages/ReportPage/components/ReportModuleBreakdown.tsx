import React from "react";
import { MODULE_KEY_MAP, type ReportModuleEntry } from "../reportPresentation";
import { MODULE_META } from "../../../constants/modules";

export function ReportModuleBreakdown({ moduleEntries }: { moduleEntries: ReportModuleEntry[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>모듈별 분석 현황</h3>
      </div>
      <div className="panel-body report-module-breakdown-body">
        <table className="data-table">
          <thead>
            <tr>
              <th className="report-table-th">모듈</th>
              <th className="report-table-th report-table-th--center">탐지 항목</th>
              <th className="report-table-th report-table-th--center">게이트 통과</th>
              <th className="report-table-th report-table-th--center">상태</th>
            </tr>
          </thead>
          <tbody>
            {moduleEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="report-table-td report-module-breakdown-empty-cell"
                >
                  해당 모듈 데이터 없음
                </td>
              </tr>
            ) : (
              moduleEntries.map(({ key, mod }) => {
                const hasFailedGate = mod.runs.some((run) => run.gate?.status === "fail");
                const passCount = mod.runs.filter((run) => run.gate?.status === "pass").length;

                return (
                  <tr key={key}>
                    <td className="report-table-td report-table-td--wrap">
                      <div className="report-module-copy">
                        <p className="report-module-title">
                          {MODULE_META[MODULE_KEY_MAP[key]]?.label ?? key}
                        </p>
                        <p className="report-module-key">{MODULE_KEY_MAP[key]}</p>
                      </div>
                    </td>
                    <td className="report-table-td report-table-td--center report-table-td--mono">
                      {mod.summary.totalFindings}
                    </td>
                    <td className="report-table-td report-table-td--center report-table-td--mono">
                      {passCount}/{mod.runs.length}
                    </td>
                    <td className="report-table-td report-table-td--center">
                      <span
                        className={
                          hasFailedGate
                            ? "report-module-status report-module-status--warning"
                            : "report-module-status report-module-status--stable"
                        }
                      >
                        {hasFailedGate ? "주의 필요" : "안정"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
