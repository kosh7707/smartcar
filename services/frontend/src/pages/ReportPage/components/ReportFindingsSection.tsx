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
  <div className="panel report-findings-card">
    <div className="panel-head report-findings-card__head">
      <h3 className="panel-title">탐지 항목 목록 ({findings.length})</h3>
    </div>
    <div className="panel-body report-findings-card__body">
      {findings.length === 0 ? (
        <div className="report-findings-card__empty">
          <EmptyState compact title="해당 조건의 탐지 항목이 없습니다" />
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th className="report-findings-card__head-cell report-findings-card__head-cell--pad">상태</th>
              <th className="report-findings-card__head-cell">심각도</th>
              <th className="report-findings-card__head-cell">제목</th>
              <th className="report-findings-card__head-cell">출처</th>
              <th className="report-findings-card__head-cell">모듈</th>
              <th className="report-findings-card__head-cell report-findings-card__head-cell--center report-findings-card__head-cell--pad">증적</th>
            </tr>
          </thead>
          <tbody>
            {findings.map(({ finding, evidenceRefs }) => (
              <tr key={finding.id}>
                <td className="report-findings-card__cell report-findings-card__cell--pad"><FindingStatusBadge status={finding.status} /></td>
                <td><SeverityBadge severity={finding.severity} /></td>
                <td className="report-findings-card__cell report-findings-card__cell--wrap">
                  <div className="report-findings-card__title-block">
                    <p className="report-findings-card__title">{finding.title}</p>
                    {finding.location && (
                      <p className="report-findings-card__location">{finding.location}</p>
                    )}
                  </div>
                </td>
                <td className="report-findings-card__cell report-findings-card__cell--wrap"><SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} /></td>
                <td>{MODULE_META[finding.module]?.label ?? finding.module}</td>
                <td className="report-findings-card__cell report-findings-card__cell--center report-findings-card__cell--pad">
                  {evidenceRefs.length > 0 ? (
                    <span className="report-findings-card__evidence-badge">
                      {evidenceRefs.length}건
                    </span>
                  ) : (
                    <span className="report-findings-card__evidence-empty">&mdash;</span>
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
