import "./TopRulesCard.css";
import React from "react";

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
    <div className="panel overall-top-rules">
      <div className="panel-head">
        <h3>룰 히트 Top {topRules.length}</h3>
      </div>
      <div className="panel-body panel-body--flush">
        <ol className="rank-list">
          {topRules.map((r, i) => (
            <li key={r.ruleId} className="rank-list__item">
              <div className="rank-row">
                <span className="rank-row__index" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="rank-row__primary rank-row__primary--rule" title={r.ruleId}>
                  {r.ruleId}
                </span>
                <div className="rank-row__bar" aria-hidden="true">
                  <div
                    className="rank-row__bar-fill"
                    style={{ width: `${(r.hitCount / maxHit) * 100}%` }}
                  />
                </div>
                <span className="rank-row__count">{r.hitCount}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
