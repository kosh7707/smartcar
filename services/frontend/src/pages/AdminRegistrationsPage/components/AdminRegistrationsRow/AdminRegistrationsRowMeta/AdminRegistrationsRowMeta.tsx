import "./AdminRegistrationsRowMeta.css";
import React from "react";

interface AdminRegistrationsRowMetaProps {
  organization: string;
  createdAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const AdminRegistrationsRowMeta: React.FC<AdminRegistrationsRowMetaProps> = ({ organization, createdAt, approvedAt, rejectedAt }) => (
  <div className="admin-reg-row__meta">
    <span>{organization}</span>
    <span>요청 {formatDateTime(createdAt)}</span>
    {approvedAt ? <span>승인 {formatDateTime(approvedAt)}</span> : null}
    {rejectedAt ? <span>반려 {formatDateTime(rejectedAt)}</span> : null}
  </div>
);
