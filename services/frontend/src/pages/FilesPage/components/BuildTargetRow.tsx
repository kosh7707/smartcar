import React from "react";
import type { BuildTarget } from "@aegis/shared";
import { Bot, FileText, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TargetProgressStepper, TargetStatusBadge } from "../../../shared/ui";
import { POST_BUILD_STATUSES } from "../hooks/useBuildTargetSection";
import { TargetLibraryPanel } from "./TargetLibraryPanel";

type BuildTargetRowProps = {
  projectId: string;
  target: BuildTarget;
  status: string;
  message?: string;
  error?: string;
  sdkName?: string;
  actionLocked: boolean;
  canDeepAnalyze: boolean;
  onOpenLog: (target: { id: string; name: string }) => void;
  onDeepAnalyze: (targetId: string) => void;
  onRetry: (targetId: string) => void;
  onEdit: (target: BuildTarget) => void;
  onDelete: (target: BuildTarget) => void;
};

export function BuildTargetRow({
  projectId,
  target,
  status,
  message,
  error,
  sdkName,
  actionLocked,
  canDeepAnalyze,
  onOpenLog,
  onDeepAnalyze,
  onRetry,
  onEdit,
  onDelete,
}: BuildTargetRowProps) {
  const isFailed = status.endsWith("_failed");
  const isRunning = status === "building" || status === "scanning" || status === "graphing" || status === "resolving";
  const isReady = status === "ready";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border px-4 py-4 transition-colors md:flex-row md:items-start",
        isFailed
          ? "border-destructive/50 bg-destructive/5"
          : isReady
            ? "border-emerald-500/40 bg-emerald-500/[0.04]"
            : "border-border/70 bg-background/80 hover:border-primary/30",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base font-semibold text-foreground">{target.name}</span>
          <TargetStatusBadge status={status} size="sm" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <span className="font-mono">{target.relativePath}</span>
          {sdkName && (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {sdkName}
            </span>
          )}
          {target.buildSystem && (
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs">
              {target.buildSystem}
            </span>
          )}
        </div>
        {target.buildCommand && (
          <div className="mt-2">
            <code className="block break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              {target.buildCommand}
            </code>
          </div>
        )}
        {status !== "discovered" && (
          <div className="mt-3">
            <TargetProgressStepper
              status={status as never}
              message={isFailed && error ? error : isRunning ? message : undefined}
            />
          </div>
        )}
        {POST_BUILD_STATUSES.has(status) && (
          <TargetLibraryPanel projectId={projectId} targetId={target.id} targetName={target.name} />
        )}
      </div>
      <div className="flex flex-row flex-wrap gap-2 md:ml-4 md:flex-col">
        {status !== "discovered" && status !== "resolving" && (
          <Button variant="outline" size="icon-sm" onClick={() => onOpenLog({ id: target.id, name: target.name })} title="빌드 로그">
            <FileText size={14} />
          </Button>
        )}
        {isReady && canDeepAnalyze && (
          <Button size="icon-sm" onClick={() => onDeepAnalyze(target.id)} title="심층 분석">
            <Bot size={14} />
          </Button>
        )}
        {isFailed && (
          <Button variant="outline" size="icon-sm" onClick={() => onRetry(target.id)} title="재실행">
            <RotateCcw size={14} />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" title="편집" onClick={() => onEdit(target)} disabled={actionLocked}>
          <Pencil size={14} />
        </Button>
        <Button variant="destructive" size="icon-sm" title="삭제" onClick={() => onDelete(target)} disabled={actionLocked}>
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
