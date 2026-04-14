import React from "react";
import { Crosshair, Play, Plus } from "lucide-react";
import { Spinner } from "../../../shared/ui";

type BuildTargetActionBarProps = {
  discovering: boolean;
  isRunning: boolean;
  hasTargets: boolean;
  configuredCount: number;
  formLocked: boolean;
  onDiscover: () => void;
  onOpenAddForm: () => void;
  onRunPipeline: () => void;
};

export function BuildTargetActionBar({
  discovering,
  isRunning,
  hasTargets,
  configuredCount,
  formLocked,
  onDiscover,
  onOpenAddForm,
  onRunPipeline,
}: BuildTargetActionBarProps) {
  return (
    <div className="bt-actions">
      <button className="btn btn-secondary btn-sm" onClick={onDiscover} disabled={discovering || isRunning}>
        {discovering ? <Spinner size={14} /> : <Crosshair size={14} />}
        타겟 탐색
      </button>
      <button className="btn btn-secondary btn-sm" onClick={onOpenAddForm} disabled={formLocked || isRunning}>
        <Plus size={14} />
        타겟 추가
      </button>
      {hasTargets && (
        <button className="btn btn-sm" onClick={onRunPipeline} disabled={isRunning || configuredCount === 0}>
          {isRunning ? <Spinner size={14} /> : <Play size={14} />}
          빌드 & 분석 실행
        </button>
      )}
    </div>
  );
}
