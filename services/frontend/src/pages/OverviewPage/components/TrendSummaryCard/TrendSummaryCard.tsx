import "./TrendSummaryCard.css";
import React from "react";
import { Activity, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { OverviewTrend } from "../../overviewModel";
import { hasTrendSignal } from "../../overviewModel";

interface TrendSummaryCardProps {
  trend?: OverviewTrend | null;
}

const trendItems = [
  {
    key: "new",
    label: "신규 발견",
    getValue: (trend?: OverviewTrend | null) => `+${trend?.newFindings ?? 0}`,
    icon: TrendingUp,
    className: "trend-summary__item trend-summary__item--new",
  },
  {
    key: "resolved",
    label: "해결됨",
    getValue: (trend?: OverviewTrend | null) => `-${trend?.resolvedFindings ?? 0}`,
    icon: TrendingDown,
    className: "trend-summary__item trend-summary__item--resolved",
  },
  {
    key: "total",
    label: "미해결 총계",
    getValue: (trend?: OverviewTrend | null) => `${trend?.unresolvedTotal ?? 0}`,
    icon: Minus,
    className: "trend-summary__item trend-summary__item--total",
  },
] as const;

export const TrendSummaryCard: React.FC<TrendSummaryCardProps> = ({ trend }) => {
  if (!hasTrendSignal(trend)) return null;

  return (
    <div className="panel trend-summary-card">
      <div className="panel-body trend-summary-card__body">
        <h3 className="panel-title trend-summary-card__title">
          <Activity size={16} />
          이전 분석 대비 변화
        </h3>
        <div className="trend-summary-card__grid">
          {trendItems.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.key} className={item.className}>
                <div className="trend-summary__item-head">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
                <div className="trend-summary__item-value">{item.getValue(trend)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
