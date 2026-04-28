import React from "react";
import type { ApprovalSevenDayStats } from "../hooks/useApprovalsPage";

interface ApprovalHeroProps {
  pendingCount: number;
  imminentCount: number;
  oldestPendingAge: number | null;
  sevenDayStats: ApprovalSevenDayStats;
  isEmpty: boolean;
}

function formatAgeShort(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}분`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)}시간`;
  return `${(hours / 24).toFixed(1)}일`;
}

/**
 * Inline status line for the approvals queue. Renders only when there is
 * pending work — when the queue is empty it returns null and the page falls
 * through to its plain header + empty body. No KPI ceremony.
 *
 * Surfaces what the filter pills do NOT: time pressure (imminent count,
 * oldest pending age). Pending count itself is highlighted via the
 * workflow-active-pending tone (`approval-status--pending`) per handoff §2.1.
 */
export const ApprovalHero: React.FC<ApprovalHeroProps> = ({
  pendingCount,
  imminentCount,
  oldestPendingAge,
  isEmpty,
}) => {
  if (isEmpty) return null;

  return (
    <p className="approvals-status" aria-label="승인 큐 현재 상태">
      <span className="approvals-status__count">
        <b className="approval-status--pending">{pendingCount}</b>
        <span>건 대기</span>
      </span>
      {imminentCount > 0 ? (
        <>
          <span className="approvals-status__sep" aria-hidden="true">·</span>
          <span className="approvals-status__warn">
            <b>{imminentCount}</b>건이 24시간 내 만료
          </span>
        </>
      ) : null}
      {oldestPendingAge !== null ? (
        <>
          <span className="approvals-status__sep" aria-hidden="true">·</span>
          <span>
            가장 오래된 요청 <b>{formatAgeShort(oldestPendingAge)}</b> 전
          </span>
        </>
      ) : null}
    </p>
  );
};
