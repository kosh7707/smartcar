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
  completed: { label: "완료", cls: "border-blue-400/50 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  running: { label: "진행 중", cls: "border-yellow-400/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-200" },
  failed: { label: "실패", cls: "border-destructive/50 bg-destructive/10 text-destructive" },
  pending: { label: "대기", cls: "border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
};

export const RecentRunsList: React.FC<Props> = ({ runs, onClickRun }) => {
  if (runs.length === 0) return null;

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-5">
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
                  <span className="text-sm text-muted-foreground">{formatDateTime(run.createdAt)}</span>
                  <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                </>
              }
            >
              <div>
                <span className="text-sm text-muted-foreground">탐지 항목 {run.findingCount}건</span>
              </div>
            </ListItem>
          );
        })}
      </CardContent>
    </Card>
  );
};
