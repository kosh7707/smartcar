import "./AdminRegistrationsStatusFilter.css";
import React from "react";
import type { RegistrationStatusFilter } from "../../useAdminRegistrationsPageController";

interface FilterEntry {
  id: RegistrationStatusFilter;
  label: string;
  dot?: "critical" | "running" | "stale";
}

const FILTERS: FilterEntry[] = [
  { id: "pending",  label: "PENDING",  dot: "running" },
  { id: "approved", label: "APPROVED" },
  { id: "rejected", label: "REJECTED", dot: "critical" },
  { id: "all",      label: "ALL" },
];

interface AdminRegistrationsStatusFilterProps {
  value: RegistrationStatusFilter;
  onChange: (value: RegistrationStatusFilter) => void;
}

export const AdminRegistrationsStatusFilter: React.FC<AdminRegistrationsStatusFilterProps> = ({ value, onChange }) => (
  <div className="filter-pills filter-pills--tabs" role="tablist" aria-label="상태 필터">
    {FILTERS.map((entry) => (
      <button
        key={entry.id}
        type="button"
        role="tab"
        aria-selected={value === entry.id}
        className={`pill${value === entry.id ? " active" : ""}`}
        onClick={() => onChange(entry.id)}
      >
        {entry.dot ? <span className={`dot ${entry.dot}`} aria-hidden="true" /> : null}
        {entry.label}
      </button>
    ))}
  </div>
);
