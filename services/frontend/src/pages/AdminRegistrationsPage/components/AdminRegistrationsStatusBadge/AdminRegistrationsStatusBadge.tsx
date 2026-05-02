import "./AdminRegistrationsStatusBadge.css";
import React from "react";
import type { RegistrationRequest } from "@aegis/shared";

interface AdminRegistrationsStatusBadgeProps {
  status: RegistrationRequest["status"];
}

export const AdminRegistrationsStatusBadge: React.FC<AdminRegistrationsStatusBadgeProps> = ({ status }) => {
  if (status === "pending_admin_review") {
    return <span className="sev-chip medium"><span className="sev-dot" />pending</span>;
  }
  if (status === "approved") {
    return <span className="sev-chip low"><span className="sev-dot" />approved</span>;
  }
  return <span className="sev-chip critical"><span className="sev-dot" />rejected</span>;
};
