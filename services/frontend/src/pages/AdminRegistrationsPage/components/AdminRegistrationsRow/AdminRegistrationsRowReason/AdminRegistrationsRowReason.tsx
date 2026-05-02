import "./AdminRegistrationsRowReason.css";
import React from "react";

interface AdminRegistrationsRowReasonProps {
  reason: string;
}

export const AdminRegistrationsRowReason: React.FC<AdminRegistrationsRowReasonProps> = ({ reason }) => (
  <div className="admin-reg-row__reason">반려 사유 — {reason}</div>
);
