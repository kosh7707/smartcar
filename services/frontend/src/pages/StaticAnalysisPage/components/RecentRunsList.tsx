import React from "react";
import type { Run } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ListItem } from "../../../shared/ui";
import { PlayCircle } from "lucide-react";
import { formatDateTime } from "../../../utils/format";

interface Props {
  runs: Run[];
  onClickRun: (runId: string) => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: "완료", cls: "badge-severity--info" },
  running: { label: "진행 중", cls: "badge-severity--medium" },
  failed: { label: "실패", cls: "badge-severity--critical" },
  pending: { label: "대기", cls: "badge-severity--low" },
};

export const RecentRunsList: React.FC<Props> = ({ runs, onClickRun }) => {
  if (runs.length === 0) return null;

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3">
        <CardTitle className="flex items-center gap-2">
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
                  <span className="recent-runs__time">
                    {formatDateTime(run.createdAt)}
                  </span>
                  <Badge variant="outline" className={st.cls}>
                    {st.label}
                  </Badge>
                </>
              }
            >
              <div className="run-item__content">
                <span className="recent-runs__finding">
                  탐지 항목 {run.findingCount}건
                </span>
              </div>
            </ListItem>
          );
        })}
      </CardContent>
    </Card>
  );
};
