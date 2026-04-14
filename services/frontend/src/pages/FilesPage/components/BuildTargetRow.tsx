import React from "react";
import type { BuildTarget } from "@aegis/shared";
import { Bot, FileText, Pencil, RotateCcw, Trash2 } from "lucide-react";
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
    <div className={`bt-row${isFailed ? " bt-row--failed" : isReady ? " bt-row--ready" : ""}`}>
      <div className="bt-row__body">
        <div className="bt-row__name-line">
          <span className="bt-row__name">{target.name}</span>
          <TargetStatusBadge status={status} size="sm" />
        </div>
        <div className="bt-row__meta">
          <span className="bt-path">{target.relativePath}</span>
          {sdkName && <span className="bt-sdk">{sdkName}</span>}
          {target.buildSystem && <span className="bt-build-sys">{target.buildSystem}</span>}
        </div>
        {target.buildCommand && (
          <div className="bt-row__build-cmd">
            <code>{target.buildCommand}</code>
          </div>
        )}
        {status !== "discovered" && (
          <div className="bt-row__stepper">
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
      <div className="bt-row__actions">
        {status !== "discovered" && status !== "resolving" && (
          <button className="btn btn-secondary btn-sm" onClick={() => onOpenLog({ id: target.id, name: target.name })} title="빌드 로그">
            <FileText size={14} />
          </button>
        )}
        {isReady && canDeepAnalyze && (
          <button className="btn btn-sm" onClick={() => onDeepAnalyze(target.id)} title="심층 분석">
            <Bot size={14} />
          </button>
        )}
        {isFailed && (
          <button className="btn btn-secondary btn-sm" onClick={() => onRetry(target.id)} title="재실행">
            <RotateCcw size={14} />
          </button>
        )}
        <button className="btn-icon" title="편집" onClick={() => onEdit(target)} disabled={actionLocked}>
          <Pencil size={14} />
        </button>
        <button className="btn-icon btn-danger" title="삭제" onClick={() => onDelete(target)} disabled={actionLocked}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
