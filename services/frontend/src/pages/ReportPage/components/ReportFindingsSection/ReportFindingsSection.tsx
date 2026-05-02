import "./ReportFindingsSection.css";
import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { MODULE_META } from "@/common/constants/modules";
import { FINDING_STATUS_LABELS } from "@/common/constants/finding";

type FindingsEntry = ProjectReport["modules"][keyof ProjectReport["modules"]] extends infer T
  ? T extends { findings: infer F }
    ? F extends Array<infer U>
      ? U
      : never
    : never
  : never;

const SEV_LABEL: Record<string, string> = {
  critical: "치명",
  high: "높음",
  medium: "보통",
  low: "낮음",
};

interface Props {
  findings: FindingsEntry[];
  showModule: boolean;
}

export const ReportFindingsSection: React.FC<Props> = ({ findings, showModule }) => {
  if (findings.length === 0) {
    return (
      <div className="report-empty-line">조건에 해당하는 탐지 항목이 없습니다.</div>
    );
  }

  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th>상태</th>
            <th>심각도</th>
            <th>제목</th>
            <th>출처</th>
            {showModule ? <th>모듈</th> : null}
            <th className="center">증적</th>
          </tr>
        </thead>
        <tbody>
          {findings.map(({ finding, evidenceRefs }) => (
            <tr key={finding.id}>
              <td>
                <span className={`report-status-tag is-${finding.status}`}>
                  {FINDING_STATUS_LABELS[
                    finding.status as keyof typeof FINDING_STATUS_LABELS
                  ] ?? finding.status}
                </span>
              </td>
              <td>
                <span className={`report-sev is-${finding.severity}`}>
                  {SEV_LABEL[finding.severity] ?? finding.severity}
                </span>
              </td>
              <td>
                <div>
                  <p className="report-finding-title">{finding.title}</p>
                  {finding.location ? (
                    <p className="report-finding-loc">{finding.location}</p>
                  ) : null}
                </div>
              </td>
              <td className="muted nowrap">
                <span className="report-source">
                  <span className="name">{finding.sourceType}</span>
                  {finding.ruleId ? ` · ${finding.ruleId}` : ""}
                </span>
              </td>
              {showModule ? (
                <td className="muted nowrap">
                  {MODULE_META[finding.module]?.label ?? finding.module}
                </td>
              ) : null}
              <td className="center mono">
                {evidenceRefs.length > 0 ? evidenceRefs.length : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
