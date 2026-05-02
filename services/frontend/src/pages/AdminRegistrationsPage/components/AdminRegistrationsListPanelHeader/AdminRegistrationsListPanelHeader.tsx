import "./AdminRegistrationsListPanelHeader.css";
import React from "react";
import type { RegistrationStatusFilter } from "../../useAdminRegistrationsPageController";
import { AdminRegistrationsStatusFilter } from "../AdminRegistrationsStatusFilter/AdminRegistrationsStatusFilter";

interface AdminRegistrationsListPanelHeaderProps {
  count: number;
  filter: RegistrationStatusFilter;
  onFilterChange: (value: RegistrationStatusFilter) => void;
}

export const AdminRegistrationsListPanelHeader: React.FC<AdminRegistrationsListPanelHeaderProps> = ({ count, filter, onFilterChange }) => (
  <div className="panel-head">
    <h3>요청 목록 <span className="count">{count}</span></h3>
    <div className="panel-tools">
      <AdminRegistrationsStatusFilter value={filter} onChange={onFilterChange} />
    </div>
  </div>
);
