import React from "react";
import { cn } from "@/lib/utils";
import type { ApprovalFilterStatus } from "../hooks/useApprovalsPage";

const FILTER_LABELS: Record<ApprovalFilterStatus, string> = {
  all: "전체",
  pending: "대기",
  approved: "승인됨",
  rejected: "거부",
  expired: "만료",
};

interface ApprovalFiltersProps {
  filter: ApprovalFilterStatus;
  onChange: (value: ApprovalFilterStatus) => void;
  statusCounts: Record<ApprovalFilterStatus, number>;
}

export const ApprovalFilters: React.FC<ApprovalFiltersProps> = ({ filter, onChange, statusCounts }) => (
  <nav className="approval-filters chore c-2" aria-label="승인 요청 필터">
    <div className="filter-pills">
      {(Object.keys(FILTER_LABELS) as ApprovalFilterStatus[]).map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={filter === status}
          className={cn("pill", filter === status && "active")}
          onClick={() => onChange(status)}
        >
          {FILTER_LABELS[status]} {statusCounts[status]}
        </button>
      ))}
    </div>
  </nav>
);
