import React from "react";
import { Activity, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import type { OverviewTrend } from "../overviewModel";
import { hasTrendSignal } from "../overviewModel";

interface TrendSummaryCardProps {
  trend?: OverviewTrend | null;
}

const trendItems = [
  {
    key: "new",
    label: "신규 발견",
    getValue: (trend?: OverviewTrend | null) => `+${trend?.newFindings ?? 0}`,
    icon: TrendingUp,
    className: "bg-red-500/8 text-red-700 dark:text-red-300",
  },
  {
    key: "resolved",
    label: "해결됨",
    getValue: (trend?: OverviewTrend | null) => `-${trend?.resolvedFindings ?? 0}`,
    icon: TrendingDown,
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "total",
    label: "미해결 총계",
    getValue: (trend?: OverviewTrend | null) => `${trend?.unresolvedTotal ?? 0}`,
    icon: Minus,
    className: "bg-muted text-foreground",
  },
] as const;

export const TrendSummaryCard: React.FC<TrendSummaryCardProps> = ({ trend }) => {
  if (!hasTrendSignal(trend)) return null;

  return (
    <Card className="border-border/70 bg-card/80 shadow-none">
      <CardContent className="space-y-4">
        <CardTitle className="flex items-center gap-2">
          <Activity size={16} />
          이전 분석 대비 변화
        </CardTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {trendItems.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.key} className={`rounded-xl px-4 py-3 ${item.className}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
                <div className="mt-3 font-mono text-2xl font-semibold leading-none tracking-tight">
                  {item.getValue(trend)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
