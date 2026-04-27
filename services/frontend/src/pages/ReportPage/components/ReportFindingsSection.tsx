import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { EmptyState, FindingStatusBadge, SeverityBadge, SourceBadge } from "../../../shared/ui";
import { MODULE_META } from "../../../constants/modules";

type FindingsEntry = ProjectReport["modules"][keyof ProjectReport["modules"]] extends infer T
  ? T extends { findings: infer F } ? F extends Array<infer U> ? U : never : never
  : never;

interface ReportFindingsSectionProps {
  findings: FindingsEntry[];
}

export const ReportFindingsSection: React.FC<ReportFindingsSectionProps> = ({ findings }) => (
  <div className="panel">
    <div className="panel-head">
      <h3>탐지 항목 목록 ({findings.length})</h3>
    </div>
    <div className="panel-body report-findings-body">
      {findings.length === 0 ? (
        <div className="report-findings-empty">
          <EmptyState compact title="해당 조건의 탐지 항목이 없습니다" />
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th className="report-table-th">상태</th>
              <th className="report-table-th">심각도</th>
              <th className="report-table-th">제목</th>
              <th className="report-table-th">출처</th>
              <th className="report-table-th">모듈</th>
              <th className="report-table-th report-table-th--center">증적</th>
            </tr>
          </thead>
          <tbody>
            {findings.map(({ finding, evidenceRefs }) => (
              <tr key={finding.id}>
                <td className="report-table-td">
                  <FindingStatusBadge status={finding.status} />
                </td>
                <td className="report-table-td">
                  <SeverityBadge severity={finding.severity} />
                </td>
                <td className="report-table-td report-table-td--wrap">
                  <div className="report-finding-title-block">
                    <p className="report-finding-title">{finding.title}</p>
                    {finding.location && (
                      <p className="report-finding-location">{finding.location}</p>
                    )}
                  </div>
                </td>
                <td className="report-table-td report-table-td--wrap">
                  <SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} />
                </td>
                <td className="report-table-td">
                  {MODULE_META[finding.module]?.label ?? finding.module}
                </td>
                <td className="report-table-td report-table-td--center">
                  {evidenceRefs.length > 0 ? (
                    <span className="report-evidence-chip">
                      {evidenceRefs.length}건
                    </span>
                  ) : (
                    <span className="report-table-empty-mark">&mdash;</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);
