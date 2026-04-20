import React from "react";
import type { Run } from "@aegis/shared";
import { PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ListItem } from "../../../shared/ui";
import { formatDateTime } from "../../../utils/format";

interface Props {
  runs: Run[];
  onClickRun: (runId: string) => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: "완료", cls: "recent-runs-list__status recent-runs-list__status--completed" },
  running: { label: "진행 중", cls: "recent-runs-list__status recent-runs-list__status--running" },
  failed: { label: "실패", cls: "recent-runs-list__status recent-runs-list__status--failed" },
  pending: { label: "대기", cls: "recent-runs-list__status recent-runs-list__status--pending" },
};

export const RecentRunsList: React.FC<Props> = ({ runs, onClickRun }) => {
  if (runs.length === 0) return null;

  return (
    <Card className="recent-runs-list-card">
      <CardContent className="recent-runs-list-card__body">
        <CardTitle className="recent-runs-list-card__title">
          <PlayCircle size={16} />
          최근 Run
        </CardTitle>
        {runs.slice(0, 10).map((run) => {
          const st = STATUS_BADGE[run.status] ?? STATUS_BADGE.pending;
          return (
            <ListItem
              key={run.id}
              onClick={() => onClickRun(run.id)}
              trailing={
                <>
                  <span className="recent-runs-list__time">{formatDateTime(run.createdAt)}</span>
                  <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                </>
              }
            >
              <div>
                <span className="recent-runs-list__finding-count">탐지 항목 {run.findingCount}건</span>
              </div>
            </ListItem>
          );
        })}
      </CardContent>
    </Card>
  );
};
