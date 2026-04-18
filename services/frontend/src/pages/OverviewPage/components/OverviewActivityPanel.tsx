import React from "react";
import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ActivityEntry } from "../../../api/projects";
import { formatDateTime } from "../../../utils/format";
import { OverviewSectionHeader } from "./OverviewSectionHeader";

interface OverviewActivityPanelProps {
  activities: ActivityEntry[];
}

export const OverviewActivityPanel: React.FC<OverviewActivityPanelProps> = ({ activities }) => (
  <section className="min-w-0 space-y-5">
    <OverviewSectionHeader title="최근 활동" />
    <Card className="gap-0 border-border/70 bg-card/80 p-0 shadow-none">
      {activities.length === 0 ? (
        <div className="px-5 py-5">
          <p className="inline-flex min-h-9 items-center rounded-lg border border-border/70 bg-background/80 px-4 text-sm font-medium text-muted-foreground">
            아직 활동 이력이 없습니다.
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-80">
          <div className="divide-y divide-border/60">
            {activities.map((activity, index) => (
              <div
                key={`${activity.timestamp}-${index}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Activity size={14} />
                  </div>
                  <span className="truncate text-sm text-foreground">{activity.summary}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                  {formatDateTime(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  </section>
);
