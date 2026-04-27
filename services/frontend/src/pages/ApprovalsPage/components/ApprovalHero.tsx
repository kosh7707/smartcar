import React from "react";
import { ClipboardCheck, Timer, Clock } from "lucide-react";
import type { ApprovalSevenDayStats } from "../hooks/useApprovalsPage";

interface ApprovalHeroProps {
  pendingCount: number;
  imminentCount: number;
  oldestPendingAge: number | null;
  sevenDayStats: ApprovalSevenDayStats;
  isEmpty: boolean;
}

function formatHoursPrecise(ms: number | null): string {
  if (ms === null) return "—";
  const hours = ms / (60 * 60 * 1000);
  if (hours < 0.1) return "<0.1시간";
  return `${hours.toFixed(1)}시간`;
}

function formatAgeShort(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)}시간 전`;
  return `${(hours / 24).toFixed(1)}일 전`;
}

// workflow-active-pending tone (handoff §2.1 6th slot whitelist) — canonical --primary-* tokens only.
export const ApprovalHero: React.FC<ApprovalHeroProps> = ({
  pendingCount,
  imminentCount,
  oldestPendingAge,
  sevenDayStats,
  isEmpty,
}) => {
  return (
    <section
      className={`hero-verdict v-pending${isEmpty ? " is-empty" : ""}`}
      aria-label="승인 큐 현재 상태"
    >
      <div className="hero-verdict__bar" aria-hidden="true" />
      <div className="hero-verdict__main">
        <div className="hero-verdict__eyebrow">
          <span className="hero-verdict__eyebrow-text">현재 큐 상태</span>
        </div>
        <div className="hero-verdict__big">
          <div className="hero-verdict__icon" aria-hidden="true">
            <ClipboardCheck />
          </div>
          <div className="hero-verdict__label">
            <span className="hero-verdict__title approval-status--pending">
              {isEmpty ? "0" : String(pendingCount)}
            </span>
            <span className="hero-verdict__sub">
              {isEmpty ? "대기 중인 결정 없음" : "대기 중인 결정"}
            </span>
          </div>
        </div>
      </div>
      <div className="hero-verdict__detail">
        {isEmpty ? (
          <>
            <div className="hero-verdict__detail-row">
              <Clock aria-hidden="true" />
              <span>모든 요청이 처리되었습니다.</span>
            </div>
            <div className="hero-verdict__detail-row">
              <Timer aria-hidden="true" />
              <span>
                {sevenDayStats.resolved > 0 ? (
                  <>
                    지난 7일간 <b>{sevenDayStats.resolved}</b>건 처리 · 평균{" "}
                    <b>{formatHoursPrecise(sevenDayStats.avgDecisionMs)}</b>
                  </>
                ) : (
                  <span className="hero-verdict__placeholder">최근 처리 이력 없음</span>
                )}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="hero-verdict__detail-row">
              <Timer aria-hidden="true" />
              <span>
                <b>{imminentCount}</b>건이 24시간 내 만료
              </span>
            </div>
            <div className="hero-verdict__detail-row">
              <Clock aria-hidden="true" />
              <span>
                가장 오래된 <b>{formatAgeShort(oldestPendingAge)}</b>
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
