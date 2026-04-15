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
  <div className="card">
    <div className="card-title">탐지 항목 목록 ({findings.length})</div>
    {findings.length === 0 ? (
      <EmptyState compact title="해당 조건의 탐지 항목이 없습니다" />
    ) : (
      <div className="report-findings">
        <div className="report-findings__header">
          <span className="report-findings__col--status">상태</span>
          <span className="report-findings__col--severity">심각도</span>
          <span className="report-findings__col--title">제목</span>
          <span className="report-findings__col--source">출처</span>
          <span className="report-findings__col--module">모듈</span>
          <span className="report-findings__col--evidence">증적</span>
        </div>
        {findings.map(({ finding, evidenceRefs }) => (
          <div key={finding.id} className="report-findings__row">
            <span className="report-findings__col--status">
              <FindingStatusBadge status={finding.status} size="sm" />
            </span>
            <span className="report-findings__col--severity">
              <SeverityBadge severity={finding.severity} size="sm" />
            </span>
            <span className="report-findings__col--title">
              <span className="report-findings__title">{finding.title}</span>
              {finding.location && (
                <span className="report-findings__location">{finding.location}</span>
              )}
            </span>
            <span className="report-findings__col--source">
              <SourceBadge sourceType={finding.sourceType} ruleId={finding.ruleId} />
            </span>
            <span className="report-findings__col--module">
              {MODULE_META[finding.module]?.label ?? finding.module}
            </span>
            <span className="report-findings__col--evidence">
              {evidenceRefs.length > 0 ? (
                <span className="report-findings__evidence-count report-findings__evidence-count--has">
                  {evidenceRefs.length}건
                </span>
              ) : (
                <span className="report-findings__evidence-count">&mdash;</span>
              )}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);
