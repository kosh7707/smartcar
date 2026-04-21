import React from "react";
import type { Run } from "@aegis/shared";
import { ChevronRight } from "lucide-react";
import { formatDateTime } from "../../../utils/format";

interface Props {
  runs: Run[];
  onClickRun: (runId: string) => void;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  completed: { label: "완료", cls: "run-status run-status--completed" },
  running: { label: "진행 중", cls: "run-status run-status--running" },
  failed: { label: "실패", cls: "run-status run-status--failed" },
  pending: { label: "대기", cls: "run-status run-status--pending" },
};

export const RecentRunsList: React.FC<Props> = ({ runs, onClickRun }) => {
  if (runs.length === 0) return null;

  return (
    <div className="panel recent-runs">
      <div className="panel-head">
        <h3>최근 Run</h3>
        <div className="panel-tools">
          <span className="sub-caps">LISTED</span>
          <b>{Math.min(runs.length, 10)}</b>
        </div>
      </div>
      <ol className="recent-runs__list">
        {runs.slice(0, 10).map((run) => {
          const st = STATUS[run.status] ?? STATUS.pending;
          const handleActivate = () => onClickRun(run.id);
          return (
            <li key={run.id} className="recent-runs__item">
              <div
                className="run-row"
                role="button"
                tabIndex={0}
                onClick={handleActivate}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleActivate();
                  }
                }}
              >
                <span className={st.cls}>
                  <span className="run-status__dot" aria-hidden="true" />
                  {st.label}
                </span>
                <span className="run-row__primary">탐지 항목 {run.findingCount}건</span>
                <time className="run-row__time">{formatDateTime(run.createdAt)}</time>
                <ChevronRight size={14} className="run-row__chev" aria-hidden="true" />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
