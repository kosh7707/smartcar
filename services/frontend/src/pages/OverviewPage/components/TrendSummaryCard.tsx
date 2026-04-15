import React from "react";
import { Activity, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import type { OverviewTrend } from "../overviewModel";
import { hasTrendSignal } from "../overviewModel";

interface TrendSummaryCardProps {
  trend?: OverviewTrend | null;
}

export const TrendSummaryCard: React.FC<TrendSummaryCardProps> = ({
  trend,
}) => {
  if (!hasTrendSignal(trend)) return null;

  return (
    <Card className="overview-trend-card shadow-none">
      <CardContent className="space-y-3">
        <CardTitle className="flex-center flex-gap-2">
          <Activity size={16} />
          이전 분석 대비 변화
        </CardTitle>
        <div className="overview-trend-row">
          <div className="overview-trend-item overview-trend-item--new">
            <TrendingUp size={16} />
            <span className="overview-trend-value">
              +{trend?.newFindings ?? 0}
            </span>
            <span className="overview-trend-label">신규 발견</span>
          </div>
          <div className="overview-trend-item overview-trend-item--resolved">
            <TrendingDown size={16} />
            <span className="overview-trend-value">
              -{trend?.resolvedFindings ?? 0}
            </span>
            <span className="overview-trend-label">해결됨</span>
          </div>
          <div className="overview-trend-item overview-trend-item--total">
            <Minus size={16} />
            <span className="overview-trend-value">
              {trend?.unresolvedTotal ?? 0}
            </span>
            <span className="overview-trend-label">미해결 총계</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
