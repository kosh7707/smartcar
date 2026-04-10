import React from "react";
import { Activity, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { OverviewTrend } from "../overviewModel";
import { hasTrendSignal } from "../overviewModel";

interface TrendSummaryCardProps {
  trend?: OverviewTrend | null;
}

export const TrendSummaryCard: React.FC<TrendSummaryCardProps> = ({ trend }) => {
  if (!hasTrendSignal(trend)) return null;

  return (
    <div className="card overview-trend-card">
      <div className="card-title flex-center flex-gap-2">
        <Activity size={16} />
        이전 분석 대비 변화
      </div>
      <div className="overview-trend-row">
        <div className="overview-trend-item overview-trend-item--new">
          <TrendingUp size={16} />
          <span className="overview-trend-value">+{trend?.newFindings ?? 0}</span>
          <span className="overview-trend-label">신규 발견</span>
        </div>
        <div className="overview-trend-item overview-trend-item--resolved">
          <TrendingDown size={16} />
          <span className="overview-trend-value">-{trend?.resolvedFindings ?? 0}</span>
          <span className="overview-trend-label">해결됨</span>
        </div>
        <div className="overview-trend-item overview-trend-item--total">
          <Minus size={16} />
          <span className="overview-trend-value">{trend?.unresolvedTotal ?? 0}</span>
          <span className="overview-trend-label">미해결 총계</span>
        </div>
      </div>
    </div>
  );
};
