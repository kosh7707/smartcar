import React from "react";
import { Button } from "@/components/ui/button";
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
  pendingCount: number;
  totalCount: number;
}

export const ApprovalFilters: React.FC<ApprovalFiltersProps> = ({
  filter,
  onChange,
  pendingCount,
  totalCount,
}) => (
  <section className="approval-toolbar" aria-label="승인 요청 필터와 요약">
    <div className="approval-filters" role="tablist" aria-label="Approval status filters">
      {(Object.keys(FILTER_LABELS) as ApprovalFilterStatus[]).map((status) => (
        <Button
          key={status}
          type="button"
          variant={filter === status ? "default" : "outline"}
          className={cn("approval-filter__btn", filter === status && "active")}
          onClick={() => onChange(status)}
        >
          {FILTER_LABELS[status]}
        </Button>
      ))}
    </div>

    <div className="approval-summary">
      <div className="approval-summary__item">
        <span className="approval-summary__label">전체 요청</span>
        <span className="approval-summary__value">{totalCount}</span>
      </div>
      <div className="approval-summary__item approval-summary__item--pending">
        <span className="approval-summary__label">대기 중</span>
        <span className="approval-summary__value">{pendingCount}</span>
      </div>
    </div>
  </section>
);
