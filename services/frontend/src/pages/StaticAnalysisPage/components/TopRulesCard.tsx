import React from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

interface TopRule {
  ruleId: string;
  hitCount: number;
}

interface Props {
  topRules: TopRule[];
}

export const TopRulesCard: React.FC<Props> = ({ topRules }) => {
  if (topRules.length === 0) return null;

  const maxHit = Math.max(...topRules.map((r) => r.hitCount), 1);

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3">
        <CardTitle>룰 히트 Top {topRules.length}</CardTitle>
        <div className="ranking-table">
          {topRules.map((r, i) => (
            <div key={r.ruleId} className="ranking-table__row">
              <span className="ranking-table__rank">{i + 1}</span>
              <span className="ranking-table__name" title={r.ruleId}>
                {r.ruleId}
              </span>
              <div className="ranking-table__bar-wrap">
                <div
                  className="ranking-table__bar"
                  style={{ width: `${(r.hitCount / maxHit) * 100}%` }}
                />
              </div>
              <span className="ranking-table__value">{r.hitCount}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
