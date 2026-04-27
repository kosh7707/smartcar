import React from "react";
import { ArrowDownNarrowWide, ArrowDownWideNarrow, List, LayoutPanelLeft } from "lucide-react";
import type {
  ApprovalFilterStatus,
  ApprovalSortMode,
  ApprovalView,
} from "../hooks/useApprovalsPage";

const FILTERS: { id: ApprovalFilterStatus; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "pending", label: "대기" },
  { id: "approved", label: "승인됨" },
  { id: "rejected", label: "거부" },
  { id: "expired", label: "만료" },
];

interface ApprovalToolbarProps {
  filter: ApprovalFilterStatus;
  onChangeFilter: (value: ApprovalFilterStatus) => void;
  statusCounts: Record<ApprovalFilterStatus, number>;
  view: ApprovalView;
  onChangeView: (value: ApprovalView) => void;
  sortMode: ApprovalSortMode;
  onChangeSort: (value: ApprovalSortMode) => void;
}

export const ApprovalToolbar: React.FC<ApprovalToolbarProps> = ({
  filter,
  onChangeFilter,
  statusCounts,
  view,
  onChangeView,
  sortMode,
  onChangeSort,
}) => {
  return (
    <div className="appr-toolbar">
      <div className="seg appr-toolbar__seg" role="tablist" aria-label="승인 요청 상태 필터">
        {FILTERS.map((entry) => {
          const isActive = filter === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={isActive ? "active" : ""}
              onClick={() => onChangeFilter(entry.id)}
            >
              <span>{entry.label}</span>
              <span className="appr-toolbar__count" aria-label={`${entry.label} ${statusCounts[entry.id]}건`}>
                {statusCounts[entry.id]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="appr-toolbar__gap" aria-hidden="true" />

      <button
        type="button"
        className="btn btn-ghost btn-sm appr-toolbar__sort"
        onClick={() => onChangeSort(sortMode === "expires" ? "created" : "expires")}
        aria-pressed={sortMode === "expires"}
        title={sortMode === "expires" ? "만료 임박 순" : "최신 등록 순"}
      >
        {sortMode === "expires" ? (
          <ArrowDownNarrowWide size={14} aria-hidden="true" />
        ) : (
          <ArrowDownWideNarrow size={14} aria-hidden="true" />
        )}
        {sortMode === "expires" ? "만료순" : "최신순"}
      </button>

      <div
        className="seg appr-toolbar__view-toggle"
        role="tablist"
        aria-label="보기 전환"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "list"}
          className={view === "list" ? "active" : ""}
          onClick={() => onChangeView("list")}
          title="목록"
        >
          <List size={14} aria-hidden="true" />
          <span className="visually-hidden">목록</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "panel"}
          className={view === "panel" ? "active" : ""}
          onClick={() => onChangeView("panel")}
          title="패널"
        >
          <LayoutPanelLeft size={14} aria-hidden="true" />
          <span className="visually-hidden">패널</span>
        </button>
      </div>
    </div>
  );
};
