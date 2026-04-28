import React from "react";
import type { ApprovalFilterStatus } from "../hooks/useApprovalsPage";

const FILTERS: { id: ApprovalFilterStatus; label: string }[] = [
  { id: "pending", label: "대기" },
  { id: "approved", label: "승인됨" },
  { id: "rejected", label: "거부" },
  { id: "expired", label: "만료" },
];

interface ApprovalToolbarProps {
  filter: ApprovalFilterStatus;
  onChangeFilter: (value: ApprovalFilterStatus) => void;
  statusCounts: Record<ApprovalFilterStatus, number>;
}

export const ApprovalToolbar: React.FC<ApprovalToolbarProps> = ({
  filter,
  onChangeFilter,
  statusCounts,
}) => (
  <div className="approvals-rail">
    <div className="seg approvals-rail__seg" role="tablist" aria-label="승인 요청 상태 필터">
      {FILTERS.map((entry) => {
        const isActive = filter === entry.id;
        const count = statusCounts[entry.id];
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-count={count}
            className={isActive ? "active" : ""}
            onClick={() => onChangeFilter(entry.id)}
          >
            <span>{entry.label}</span>
            <span className="approvals-rail__count" aria-label={`${entry.label} ${count}건`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);
