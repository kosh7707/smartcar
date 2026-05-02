import "./AdminRegistrationsRefreshButton.css";
import React from "react";
import { RefreshCw } from "lucide-react";

interface AdminRegistrationsRefreshButtonProps {
  loading: boolean;
  onClick: () => void;
}

export const AdminRegistrationsRefreshButton: React.FC<AdminRegistrationsRefreshButtonProps> = ({ loading, onClick }) => (
  <button type="button" className="btn btn-outline btn-sm" onClick={onClick} disabled={loading}>
    <RefreshCw size={14} aria-hidden="true" />
    {loading ? "불러오는 중..." : "새로고침"}
  </button>
);
