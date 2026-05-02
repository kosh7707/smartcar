import "./ApprovalListRail.css";
import React, { useCallback, useEffect, useRef } from "react";
import type { ApprovalRequest } from "@/common/api/approval";
import type {
  ApprovalFilterStatus,
  ApprovalSevenDayStats,
} from "../../useApprovalsPageController";
import { ACTION_LABELS } from "../../approvalPresentation";
import {
  formatHoursPrecise,
  formatLeftShort,
  formatSubmittedShort,
} from "../../approvalFormat";

const EMPTY_TITLE: Record<ApprovalFilterStatus, string> = {
  pending: "처리할 승인 요청이 없습니다",
  approved: "승인된 요청이 없습니다",
  rejected: "거부된 요청이 없습니다",
  expired: "만료된 요청이 없습니다",
  all: "승인 요청이 없습니다",
};

const EMPTY_HINT: Partial<Record<ApprovalFilterStatus, string>> = {
  pending: "Gate 오버라이드 또는 위험 수용 요청이 생성되면 이 자리에 표시됩니다.",
};

const IMMINENT_WINDOW_MS = 24 * 60 * 60 * 1000;

interface Props {
  approvals: ApprovalRequest[];
  filter: ApprovalFilterStatus;
  selectedId: string | null;
  hasProject: boolean;
  sevenDayStats: ApprovalSevenDayStats;
  onSelect: (id: string | null) => void;
}

export const ApprovalListRail: React.FC<Props> = ({
  approvals,
  filter,
  selectedId,
  hasProject,
  sevenDayStats,
  onSelect,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (approvals.length === 0) {
      if (selectedId !== null) onSelect(null);
      return;
    }
    if (!selectedId || !approvals.some((a) => a.id === selectedId)) {
      onSelect(approvals[0]!.id);
    }
  }, [approvals, selectedId, onSelect]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (approvals.length === 0) return;
      const idx = Math.max(0, approvals.findIndex((a) => a.id === selectedId));
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = approvals[Math.min(approvals.length - 1, idx + 1)];
        if (next) onSelect(next.id);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const prev = approvals[Math.max(0, idx - 1)];
        if (prev) onSelect(prev.id);
      } else if (event.key === "Home") {
        event.preventDefault();
        onSelect(approvals[0]!.id);
      } else if (event.key === "End") {
        event.preventDefault();
        onSelect(approvals[approvals.length - 1]!.id);
      }
    },
    [approvals, onSelect, selectedId],
  );

  const isEmpty = approvals.length === 0;
  const emptyTitle = EMPTY_TITLE[filter] ?? EMPTY_TITLE.all;
  const emptyHint = EMPTY_HINT[filter];

  return (
    <aside className="appr-rail">
      <div
        ref={listRef}
        className="appr-rail__list"
        role={isEmpty ? undefined : "tablist"}
        aria-label={isEmpty ? undefined : "승인 요청 목록"}
        aria-orientation={isEmpty ? undefined : "vertical"}
        onKeyDown={handleKeyDown}
      >
        {isEmpty ? (
          <div className="appr-rail__empty" role="status">
            <p className="appr-rail__empty-title">{emptyTitle}</p>
            {emptyHint ? <p className="appr-rail__empty-hint">{emptyHint}</p> : null}
            {hasProject && sevenDayStats.resolved > 0 ? (
              <p className="appr-rail__empty-audit">
                지난 7일 {sevenDayStats.resolved}건 결정 · 평균{" "}
                {formatHoursPrecise(sevenDayStats.avgDecisionMs)}
              </p>
            ) : null}
          </div>
        ) : (
          approvals.map((approval) => {
            const isSelected = approval.id === selectedId;
            const expiresMs = new Date(approval.expiresAt).getTime();
            const deltaMs = expiresMs - Date.now();
            const isImminent =
              approval.status === "pending" && deltaMs > 0 && deltaMs <= IMMINENT_WINDOW_MS;
            const slaText =
              approval.status === "pending"
                ? formatLeftShort(deltaMs)
                : new Date(approval.createdAt).toLocaleDateString();
            return (
              <button
                key={approval.id}
                type="button"
                role="tab"
                id={`appr-rail-tab-${approval.id}`}
                aria-selected={isSelected}
                aria-controls="appr-doc"
                tabIndex={isSelected ? 0 : -1}
                className={`appr-rail__row${isSelected ? " is-selected" : ""}${
                  isImminent ? " is-imminent" : ""
                }`}
                onClick={() => onSelect(approval.id)}
                data-approval-id={approval.id}
              >
                <div className="appr-rail__top">
                  <span className="appr-rail__id">{approval.id}</span>
                  <span>{formatSubmittedShort(approval.createdAt)}</span>
                </div>
                <div className="appr-rail__title">
                  {ACTION_LABELS[approval.actionType] ?? approval.actionType}
                </div>
                <div className="appr-rail__meta">
                  <span className="appr-rail__who">{approval.requestedBy}</span>
                  <span className="appr-rail__sla">{slaText}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
