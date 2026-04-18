import React from "react";
import { HardDrive, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { useBuildTargets } from "../../../hooks/useBuildTargets";
import { TargetStatusBadge } from "../../../shared/ui";

export function FilesBuildTargetPanel({
  targets,
  onOpenLog,
}: {
  targets: ReturnType<typeof useBuildTargets>["targets"];
  onOpenLog: (target: { id: string; name: string }) => void;
}) {
  if (targets.length === 0) return null;

  return (
    <Card className="border-border/80 bg-card/95 shadow-none">
      <CardHeader className="border-b border-border/70 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <HardDrive size={16} />
          빌드 타겟 현황
          <span className="font-normal text-muted-foreground/80">({targets.length}개)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        {targets.map((target) => (
          <div
            key={target.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-background/80 px-4 py-3 transition-colors hover:border-primary/30"
          >
            <span className="font-medium text-foreground">{target.name}</span>
            <TargetStatusBadge status={target.status ?? "discovered"} size="sm" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground md:text-sm">
              {target.relativePath}
            </span>
            {target.status && target.status !== "discovered" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenLog({ id: target.id, name: target.name })}
                title="빌드 로그"
              >
                <ScrollText size={14} />
                빌드 로그
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
