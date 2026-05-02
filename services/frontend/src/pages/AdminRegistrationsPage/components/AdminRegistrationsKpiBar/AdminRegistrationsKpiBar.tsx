import "./AdminRegistrationsKpiBar.css";
import React from "react";
import { AdminRegistrationsKpiChip } from "../AdminRegistrationsKpiChip/AdminRegistrationsKpiChip";

interface AdminRegistrationsKpiBarProps {
  pending: number;
  approved: number;
  rejected: number;
  pendingActive: boolean;
}

export const AdminRegistrationsKpiBar: React.FC<AdminRegistrationsKpiBarProps> = ({ pending, approved, rejected, pendingActive }) => (
  <div className="status-chips admin-reg-kpi" role="group" aria-label="가입 요청 현황">
    <AdminRegistrationsKpiChip tone="pending" label="대기" count={pending} active={pendingActive} />
    <AdminRegistrationsKpiChip tone="approved" label="승인 완료" count={approved} />
    <AdminRegistrationsKpiChip tone="rejected" label="반려" count={rejected} />
  </div>
);
