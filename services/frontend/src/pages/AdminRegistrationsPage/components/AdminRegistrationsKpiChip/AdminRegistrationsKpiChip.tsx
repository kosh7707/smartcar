import "./AdminRegistrationsKpiChip.css";
import React from "react";

type KpiChipTone = "pending" | "approved" | "rejected";

interface AdminRegistrationsKpiChipProps {
  tone: KpiChipTone;
  label: string;
  count: number;
  active?: boolean;
}

const TONE_CLASS: Record<KpiChipTone, string> = {
  pending: "status-chip--pending admin-reg-kpi__chip--pending",
  approved: "status-chip--approved",
  rejected: "status-chip--rejected",
};

export const AdminRegistrationsKpiChip: React.FC<AdminRegistrationsKpiChipProps> = ({ tone, label, count, active }) => (
  <div className={`status-chip admin-reg-kpi__chip ${TONE_CLASS[tone]}${active ? " status-chip--active" : ""}`}>
    <span className="status-chip__label">{label}</span>
    <span className="status-chip__count">{count}</span>
  </div>
);
