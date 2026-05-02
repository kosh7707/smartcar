import "./AdminRegistrationsRowSummary.css";
import React from "react";
import type { RegistrationRequest } from "@aegis/shared";
import { AdminRegistrationsStatusBadge } from "../../AdminRegistrationsStatusBadge/AdminRegistrationsStatusBadge";

interface AdminRegistrationsRowSummaryProps {
  fullName: string;
  status: RegistrationRequest["status"];
  assignedRole?: string | null;
}

export const AdminRegistrationsRowSummary: React.FC<AdminRegistrationsRowSummaryProps> = ({ fullName, status, assignedRole }) => (
  <div className="admin-reg-row__head">
    <span className="admin-reg-row__name">{fullName}</span>
    <AdminRegistrationsStatusBadge status={status} />
    {assignedRole ? <span className="admin-reg-row__role-badge">{assignedRole}</span> : null}
  </div>
);
