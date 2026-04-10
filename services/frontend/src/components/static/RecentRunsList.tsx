import React from "react";
import type { Run } from "@aegis/shared";
import { ListItem } from "../ui";
import { PlayCircle } from "lucide-react";
import { formatDateTime } from "../../utils/format";

interface Props {
  runs: Run[];
  onClickRun: (runId: string) => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: "완료", cls: "badge badge-info" },
  running: { label: "진행 중", cls: "badge badge-warning" },
  failed: { label: "실패", cls: "badge badge-critical" },
  pending: { label: "대기", cls: "badge badge-low" },
};

export const RecentRunsList: React.FC<Props> = ({ runs, onClickRun }) => {
  if (runs.length === 0) return null;

  return (
    <div className="card">
      <div className="card-title">
        <PlayCircle size={16} />
        최근 Run
      </div>
      {runs.slice(0, 10).map((run) => {
        const st = STATUS_BADGE[run.status] ?? STATUS_BADGE.pending;
        return (
          <ListItem
            key={run.id}
            onClick={() => onClickRun(run.id)}
            trailing={
              <>
                <span className="text-xs text-tertiary">{formatDateTime(run.createdAt)}</span>
                <span className={st.cls}>{st.label}</span>
              </>
            }
          >
            <div className="run-item__content">
              <span className="text-sm">Finding {run.findingCount}건</span>
            </div>
          </ListItem>
        );
      })}
    </div>
  );
};
