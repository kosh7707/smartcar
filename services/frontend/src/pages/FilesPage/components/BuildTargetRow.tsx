import React from "react";
import type { BuildTarget } from "@aegis/shared";
import { Bot, FileText, Pencil, RotateCcw, Trash2 } from "lucide-react";
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
        "build-target-row",
        isFailed
          ? "build-target-row--failed"
          : isReady
            ? "build-target-row--ready"
            : "build-target-row--default",
      )}
    >
      <div className="build-target-row__main">
        <div className="build-target-row__head">
          <span className="build-target-row__title">{target.name}</span>
          <TargetStatusBadge status={status} />
        </div>
        <div className="build-target-row__meta">
          <span className="build-target-row__path">{target.relativePath}</span>
          {sdkName && (
            <span className="build-target-row__chip build-target-row__chip--sdk">
              {sdkName}
            </span>
          )}
          {target.buildSystem && (
            <span className="build-target-row__chip build-target-row__chip--system">
              {target.buildSystem}
            </span>
          )}
        </div>
        {target.buildCommand && (
          <div className="build-target-row__command-wrap">
            <code className="build-target-row__command">
              {target.buildCommand}
            </code>
          </div>
        )}
        {status !== "discovered" && (
          <div className="build-target-row__stepper">
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
      <div className="build-target-row__actions">
        {status !== "discovered" && status !== "resolving" && (
          <button type="button" className="btn btn-outline btn-icon-sm" onClick={() => onOpenLog({ id: target.id, name: target.name })} title="빌드 로그">
            <FileText size={14} />
          </button>
        )}
        {isReady && canDeepAnalyze && (
          <button type="button" className="btn btn-primary btn-icon-sm" onClick={() => onDeepAnalyze(target.id)} title="심층 분석">
            <Bot size={14} />
          </button>
        )}
        {isFailed && (
          <button type="button" className="btn btn-outline btn-icon-sm" onClick={() => onRetry(target.id)} title="재실행">
            <RotateCcw size={14} />
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-icon-sm" title="편집" onClick={() => onEdit(target)} disabled={actionLocked}>
          <Pencil size={14} />
        </button>
        <button type="button" className="btn btn-danger btn-icon-sm" title="삭제" onClick={() => onDelete(target)} disabled={actionLocked}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
