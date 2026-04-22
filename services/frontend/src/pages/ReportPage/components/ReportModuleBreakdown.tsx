import React from "react";
import { MODULE_KEY_MAP, type ReportModuleEntry } from "../reportPresentation";
import { MODULE_META } from "../../../constants/modules";

export function ReportModuleBreakdown({ moduleEntries }: { moduleEntries: ReportModuleEntry[] }) {
  return (
    <div className="panel report-module-breakdown-card">
      <div className="panel-head report-module-breakdown-card__head">
        <h3 className="panel-title">모듈별 분석 현황</h3>
      </div>
      <div className="panel-body report-module-breakdown-card__body">
        <table className="data-table">
          <thead>
            <tr>
              <th className="report-module-breakdown-card__head-cell report-module-breakdown-card__head-cell--pad">모듈</th>
              <th className="report-module-breakdown-card__head-cell report-module-breakdown-card__head-cell--center">탐지 항목</th>
              <th className="report-module-breakdown-card__head-cell report-module-breakdown-card__head-cell--center">게이트 통과</th>
              <th className="report-module-breakdown-card__head-cell report-module-breakdown-card__head-cell--pad report-module-breakdown-card__head-cell--right">상태</th>
            </tr>
          </thead>
          <tbody>
            {moduleEntries.length === 0 ? (
              <tr>
                <td colSpan={4} className="report-module-breakdown-card__empty-cell">
                  해당 모듈 데이터 없음
                </td>
              </tr>
            ) : (
              moduleEntries.map(({ key, mod }) => {
                const hasFailedGate = mod.runs.some((run) => run.gate?.status === "fail");

                return (
                  <tr key={key}>
                    <td className="report-module-breakdown-card__cell report-module-breakdown-card__cell--pad report-module-breakdown-card__cell--wrap">
                      <div className="report-module-breakdown-card__module-copy">
                        <p className="report-module-breakdown-card__module-title">
                          {MODULE_META[MODULE_KEY_MAP[key]]?.label ?? key}
                        </p>
                        <p className="report-module-breakdown-card__module-key">{MODULE_KEY_MAP[key]}</p>
                      </div>
                    </td>
                    <td className="report-module-breakdown-card__cell report-module-breakdown-card__cell--center report-module-breakdown-card__cell--mono">{mod.summary.totalFindings}</td>
                    <td className="report-module-breakdown-card__cell report-module-breakdown-card__cell--center">
                      {mod.runs.filter((run) => run.gate?.status === "pass").length}/{mod.runs.length}
                    </td>
                    <td className="report-module-breakdown-card__cell report-module-breakdown-card__cell--pad report-module-breakdown-card__cell--right">
                      <span
                        className={hasFailedGate
                          ? "report-module-breakdown-card__status-badge report-module-breakdown-card__status-badge--warning"
                          : "report-module-breakdown-card__status-badge report-module-breakdown-card__status-badge--stable"}
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
