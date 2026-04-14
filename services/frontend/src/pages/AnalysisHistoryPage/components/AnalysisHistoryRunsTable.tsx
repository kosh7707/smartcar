import React from "react";
import type { Run } from "@aegis/shared";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "../../../shared/ui";
import { MODULE_META } from "../../../constants/modules";
import { formatDateTime, formatUptime } from "../../../utils/format";
import type { AnalysisHistoryFilter } from "../hooks/useAnalysisHistoryPage";

type HistoryRun = Run & {
  severitySummary?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
};

const STATUS_LABELS: Record<string, string> = {
  completed: "완료",
  running: "실행 중",
  failed: "실패",
  queued: "대기",
};

const EMPTY_TITLES: Record<AnalysisHistoryFilter, string> = {
  all: "아직 분석 이력이 없습니다",
  static_analysis: "해당 모듈의 분석 이력이 없습니다",
  deep_analysis: "해당 모듈의 분석 이력이 없습니다",
};

interface AnalysisHistoryRunsTableProps {
  filter: AnalysisHistoryFilter;
  runs: HistoryRun[];
  onOpenRun: () => void;
}

export const AnalysisHistoryRunsTable: React.FC<AnalysisHistoryRunsTableProps> = ({
  filter,
  runs,
  onOpenRun,
}) => {
  if (runs.length === 0) {
    return (
      <section className="history-panel history-panel--empty">
        <EmptyState
          title={EMPTY_TITLES[filter]}
          description="분석이 실행되면 이력, 심각도 분포, 소요 시간 정보를 이곳에서 확인할 수 있습니다."
        />
      </section>
    );
  }

  return (
    <section className="history-panel">
      <div className="history-panel__header">
        <div>
          <h3 className="history-panel__title">최근 실행</h3>
          <p className="history-panel__subtitle">분석 시점, 심각도 요약, 소요 시간을 한 번에 검토합니다.</p>
        </div>
      </div>

      <div className="history-table-scroll">
        <table className="history-table">
          <thead>
            <tr className="history-table__head-row">
              <th className="history-table__th">실행</th>
              <th className="history-table__th">시각</th>
              <th className="history-table__th">모듈</th>
              <th className="history-table__th">상태</th>
              <th className="history-table__th history-table__th--center">Finding 요약</th>
              <th className="history-table__th">소요 시간</th>
              <th className="history-table__th history-table__th--action" />
            </tr>
          </thead>
          <tbody>
            {runs.map((run, index) => {
              const meta = MODULE_META[run.module] ?? { label: run.module, icon: null };
              const durationSec = run.startedAt && run.endedAt
                ? (new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
                : 0;
              const severity = run.severitySummary;
              return (
                <tr
                  key={run.id}
                  className="history-table__row"
                  onClick={onOpenRun}
                >
                  <td className="history-table__td history-table__td--run">#{index + 1}</td>
                  <td className="history-table__td history-table__td--mono">{formatDateTime(run.createdAt)}</td>
                  <td className="history-table__td">
                    <span className="history-table__module">
                      <span className="history-table__module-icon">{meta.icon}</span>
                      {meta.label}
                    </span>
                  </td>
                  <td className="history-table__td">
                    <span className={`history-table__status history-table__status--${run.status === "completed" ? "pass" : run.status === "failed" ? "fail" : "running"}`}>
                      {STATUS_LABELS[run.status] ?? run.status}
                    </span>
                  </td>
                  <td className="history-table__td history-table__td--center history-table__td--mono">
                    {severity ? (
                      <span className="history-sev-summary">
                        <span className={`history-sev history-sev--critical${!severity.critical ? " history-sev--zero" : ""}`}>{severity.critical ?? 0}</span>
                        <span className="history-sev__sep">/</span>
                        <span className={`history-sev history-sev--high${!severity.high ? " history-sev--zero" : ""}`}>{severity.high ?? 0}</span>
                        <span className="history-sev__sep">/</span>
                        <span className={`history-sev history-sev--medium${!severity.medium ? " history-sev--zero" : ""}`}>{severity.medium ?? 0}</span>
                        <span className="history-sev__sep">/</span>
                        <span className={`history-sev history-sev--low${!severity.low ? " history-sev--zero" : ""}`}>{severity.low ?? 0}</span>
                      </span>
                    ) : run.findingCount > 0 ? (
                      <span className="history-table__finding-count">{run.findingCount}</span>
                    ) : (
                      <span className="history-sev--zero">—</span>
                    )}
                  </td>
                  <td className="history-table__td history-table__td--mono">
                    {durationSec > 0 ? formatUptime(durationSec) : "—"}
                  </td>
                  <td className="history-table__td history-table__td--action">
                    <ChevronRight size={16} className="history-table__chevron" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
