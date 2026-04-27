import React from "react";
import { CheckCheck, Inbox, Clock } from "lucide-react";
import type { ApprovalFilterStatus, ApprovalSevenDayStats } from "../hooks/useApprovalsPage";

interface ApprovalEmptyStateProps {
  filter: ApprovalFilterStatus;
  sevenDayStats: ApprovalSevenDayStats;
  hasProject: boolean;
}

const EMPTY_COPY: Record<
  ApprovalFilterStatus,
  { title: string; desc: string; tone: "is-pass" | "is-pending" }
> = {
  pending: {
    title: "처리할 승인 요청이 없습니다",
    desc: "Gate 오버라이드 · Finding 위험 수용 요청이 들어오면 이 자리에 표시됩니다.",
    tone: "is-pass",
  },
  approved: {
    title: "승인된 요청이 없습니다",
    desc: "결정 이력은 승인됨으로 이동하면 여기에 누적됩니다.",
    tone: "is-pending",
  },
  rejected: {
    title: "거부된 요청이 없습니다",
    desc: "거부 결정과 사유 코멘트가 이 자리에 누적됩니다.",
    tone: "is-pending",
  },
  expired: {
    title: "만료된 요청이 없습니다",
    desc: "결정 없이 expiresAt 을 지난 요청이 이 자리에 누적됩니다.",
    tone: "is-pending",
  },
  all: {
    title: "승인 요청이 없습니다",
    desc: "Gate 오버라이드 · Finding 위험 수용 요청이 들어오면 결정 이력과 감사 로그가 자동으로 기록됩니다.",
    tone: "is-pass",
  },
};

function formatHoursPrecise(ms: number | null): string {
  if (ms === null) return "—";
  const hours = ms / (60 * 60 * 1000);
  if (hours < 0.1) return "<0.1시간";
  return `${hours.toFixed(1)}시간`;
}

export const ApprovalEmptyState: React.FC<ApprovalEmptyStateProps> = ({
  filter,
  sevenDayStats,
  hasProject,
}) => {
  const copy = EMPTY_COPY[filter] ?? EMPTY_COPY.all;
  const Icon = copy.tone === "is-pass" ? CheckCheck : Inbox;
  return (
    <div className={`empty-state appr-empty ${copy.tone}`} role="status">
      <div className="empty-state__icon" aria-hidden="true">
        <Icon />
      </div>
      <div className="empty-state__copy">
        <h3 className="empty-state__title">{copy.title}</h3>
        <p className="empty-state__desc">{copy.desc}</p>
      </div>
      {hasProject && sevenDayStats.resolved > 0 ? (
        <div className="empty-state__hint">
          <Clock aria-hidden="true" />
          지난 7일간 <b>{sevenDayStats.resolved}</b>건 처리 완료 · 평균{" "}
          <b>{formatHoursPrecise(sevenDayStats.avgDecisionMs)}</b>
        </div>
      ) : null}
    </div>
  );
};
