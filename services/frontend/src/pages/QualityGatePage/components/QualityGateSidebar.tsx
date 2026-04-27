import React from "react";
import type { GateResult } from "../../../api/gate";
import { formatDateTime } from "../../../utils/format";
import { STATUS_CONFIG, sparkBarTone } from "../qualityGatePresentation";

const SPARK_BAR_COUNT = 8;

export function QualityGateSidebar({ gates }: { gates: GateResult[] }) {
  // Sparkline reads oldest → newest (left → right), so reverse the newest-first slice.
  const recentForSpark = gates.slice(0, SPARK_BAR_COUNT).reverse();
  const placeholderCount = Math.max(0, SPARK_BAR_COUNT - recentForSpark.length);

  const recent = gates.slice(0, 8);
  const passCount = gates.filter((gate) => gate.status === "pass").length;
  const failCount = gates.filter((gate) => gate.status === "fail").length;
  const warnCount = gates.filter((gate) => gate.status === "warning").length;

  return (
    <aside className="quality-gate-sidebar" aria-label="품질 게이트 보조 정보">
      <section className="panel quality-gate-sidebar__history">
        <div className="panel-head">
          <h3>
            최근 평가 추세
            <span className="count" aria-hidden="true">{gates.length || 0}회</span>
          </h3>
        </div>

        <div className="spark-wrap" role="img" aria-label="최근 8회 평가 추세">
          <div className="spark-row">
            {Array.from({ length: placeholderCount }).map((_, idx) => (
              <span
                key={`spark-placeholder-${idx}`}
                className="spark-bar is-placeholder"
                aria-hidden="true"
              />
            ))}
            {recentForSpark.map((gate) => {
              const tone = sparkBarTone(gate.status);
              return (
                <span
                  key={gate.id}
                  className={`spark-bar ${tone}`}
                  title={`${formatDateTime(gate.evaluatedAt)} · ${gate.status}`}
                  aria-hidden="true"
                />
              );
            })}
          </div>
          <div className="spark-legend">
            <span><span className="spark-legend__dot pass" />{passCount} 통과</span>
            <span><span className="spark-legend__dot fail" />{failCount} 차단</span>
            <span><span className="spark-legend__dot warn" />{warnCount} 경고</span>
          </div>
        </div>

        <div className="panel-body panel-body--flush">
          <ol className="quality-gate-sidebar__history-list">
            {recent.map((gate, index) => {
              const config = STATUS_CONFIG[gate.status] ?? STATUS_CONFIG.warning;
              return (
                <li
                  key={gate.id}
                  className={`quality-gate-sidebar__history-row${index === 0 ? " is-latest" : ""}`}
                >
                  <span className="quality-gate-sidebar__history-index">
                    #{index + 1}
                  </span>
                  <time className="quality-gate-sidebar__history-time">
                    {formatDateTime(gate.evaluatedAt)}
                  </time>
                  <span
                    className={`cell-gate ${config.gateMod} quality-gate-sidebar__history-status`}
                    aria-label={`판정 ${config.historyLabel}`}
                  >
                    {config.historyLabel}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="panel quality-gate-sidebar__guide">
        <div className="panel-head">
          <h3>오버라이드 안내</h3>
        </div>

        <div className="panel-body quality-gate-sidebar__guide-body">
          <p className="quality-gate-sidebar__guide-copy">
            오버라이드는 승인된 프로젝트 리드만 실행할 수 있습니다.
            사유는 최소 10자 이상 — 사후 감사 추적을 위해 명확히 작성하고,
            오버라이드는 다음 평가까지만 유효합니다.
          </p>
        </div>
      </section>
    </aside>
  );
}
