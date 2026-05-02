import "./ReportRunsSection.css";
import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { MODULE_META } from "@/common/constants/modules";
import { formatDateTime } from "@/common/utils/format";

type RunsEntry = ProjectReport["modules"][keyof ProjectReport["modules"]] extends infer T
  ? T extends { runs: infer F }
    ? F extends Array<infer U>
      ? U
      : never
    : never
  : never;

interface Props {
  runs: RunsEntry[];
  showModule: boolean;
}

export const ReportRunsSection: React.FC<Props> = ({ runs, showModule }) => {
  if (runs.length === 0) {
    return <div className="report-empty-line">실행 이력이 없습니다.</div>;
  }

  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th>실행</th>
            {showModule ? <th>모듈</th> : null}
            <th>상태</th>
            <th>게이트</th>
            <th className="center">탐지</th>
            <th>시각</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(({ run, gate }) => {
            const gateStatus = gate?.status as "pass" | "fail" | undefined;
            const gateClass = gateStatus
              ? `report-gate-tag is-${gateStatus}`
              : "report-gate-tag is-none";
            return (
              <tr key={run.id}>
                <td className="mono">{run.id.slice(0, 8)}</td>
                {showModule ? (
                  <td className="muted nowrap">
                    {MODULE_META[run.module]?.label ?? run.module}
                  </td>
                ) : null}
                <td>
                  <span className={`report-status-tag is-${run.status}`}>
                    {run.status}
                  </span>
                </td>
                <td>
                  <span className={gateClass}>
                    {gateStatus ? gateStatus.toUpperCase() : "—"}
                  </span>
                </td>
                <td className="center mono">{run.findingCount}</td>
                <td className="muted nowrap mono">
                  {formatDateTime(run.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
