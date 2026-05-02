import "./ReportApprovalsSection.css";
import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "@/common/utils/format";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "거부",
  expired: "만료",
};

interface Props {
  approvals: ProjectReport["approvals"];
}

export const ReportApprovalsSection: React.FC<Props> = ({ approvals }) => {
  if (approvals.length === 0) {
    return <div className="report-empty-line">관련 승인 요청이 없습니다.</div>;
  }

  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>상태</th>
            <th>유형</th>
            <th>요청자</th>
            <th>결정자</th>
            <th>시각</th>
          </tr>
        </thead>
        <tbody>
          {approvals.map((a) => (
            <tr key={a.id}>
              <td className="mono">{a.id}</td>
              <td>
                <span className={`report-status-tag is-${a.status}`}>
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
              </td>
              <td className="mono">{a.actionType}</td>
              <td>{a.requestedBy}</td>
              <td className="muted">{a.decision?.decidedBy ?? "—"}</td>
              <td className="muted nowrap mono">{formatDateTime(a.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
