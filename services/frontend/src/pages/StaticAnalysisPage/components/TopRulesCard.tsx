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
    <Card className="overall-top-rules-card">
      <CardContent className="overall-top-rules-card__body">
        <CardTitle>룰 히트 Top {topRules.length}</CardTitle>
        <div className="overall-top-rules-card__list">
          {topRules.map((r, i) => (
            <div key={r.ruleId} className="overall-top-rules-card__row">
              <span className="overall-top-rules-card__rank">{i + 1}</span>
              <span className="overall-top-rules-card__name" title={r.ruleId}>
                {r.ruleId}
              </span>
              <div className="overall-top-rules-card__bar">
                <div className="overall-top-rules-card__bar-fill" style={{ width: `${(r.hitCount / maxHit) * 100}%` }} />
              </div>
              <span className="overall-top-rules-card__count">{r.hitCount}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
