import React from "react";
import { Crosshair } from "lucide-react";
import { ConfirmDialog, ConnectionStatusBanner, Spinner } from "../../../shared/ui";
import { BuildProfileForm } from "./BuildProfileForm";
import { BuildLogViewer } from "./BuildLogViewer";
import { BuildTargetActionBar } from "./BuildTargetActionBar";
import { BuildTargetRow } from "./BuildTargetRow";
import { BuildTargetSectionSummary } from "./BuildTargetSectionSummary";
import { BuildTargetCreateDialog } from "./BuildTargetCreateDialog";
import { DEFAULT_PROFILE, INCLUDED_PATHS_EDIT_GUARD_TEXT, useBuildTargetSection } from "../hooks/useBuildTargetSection";
import "./BuildTargetSection.css";

interface Props {
  projectId: string;
  onStartDeepAnalysis?: (buildTargetIds: string[]) => void;
}

export const BuildTargetSection: React.FC<Props> = ({ projectId, onStartDeepAnalysis }) => {
  const state = useBuildTargetSection(projectId, onStartDeepAnalysis);

  return (
    <div className="card gs-card">
      <ConnectionStatusBanner connectionState={state.pipeline.connectionState} />
      <div className="gs-card__header">
        <div className="gs-card__icon"><Crosshair size={18} /></div>
        <div>
          <div className="gs-card__title">빌드 타겟</div>
          <div className="gs-card__desc">
            프로젝트 내 독립 빌드 단위를 관리합니다. 타겟별로 SDK 설정 후 빌드 & 분석을 실행하세요.
          </div>
        </div>
      </div>

      <BuildTargetActionBar
        discovering={state.buildTargets.discovering}
        isRunning={state.pipeline.isRunning}
        hasTargets={state.buildTargets.targets.length > 0}
        configuredCount={state.configuredCount}
        formLocked={state.formMode !== null || state.editingTarget !== null}
        onDiscover={state.handleDiscover}
        onOpenAddForm={state.openAddForm}
        onRunPipeline={state.handleRunPipeline}
      />

      {state.formMode === "add" && (
        <div className="bt-form">
          <div className="bt-form__grid">
            <label className="form-field">
              <span className="form-label">타겟 이름</span>
              <input className="form-input" value={state.formName} onChange={(event) => state.setFormName(event.target.value)} placeholder="빌드 타겟 이름" autoFocus />
            </label>
            <label className="form-field">
              <span className="form-label">상대 경로</span>
              <input className="form-input font-mono" value={state.formPath} onChange={(event) => state.setFormPath(event.target.value)} placeholder="src/module-dir/" spellCheck={false} />
            </label>
          </div>
          <BuildProfileForm value={state.formProfile} onChange={state.setFormProfile} registeredSdks={state.registeredSdks} />
          <div className="bt-form__actions">
            <button className="btn btn-secondary btn-sm" onClick={state.closeForm}>취소</button>
            <button className="btn btn-sm" onClick={state.handleSave} disabled={state.saving}>{state.saving ? "저장 중..." : "추가"}</button>
          </div>
        </div>
      )}

      {state.buildTargets.loading ? (
        <div className="bt-empty"><Spinner size={20} label="로딩 중..." /></div>
      ) : state.buildTargets.targets.length === 0 && state.formMode !== "add" ? (
        <div className="bt-empty">
          아직 빌드 타겟이 없습니다. "타겟 탐색"으로 자동 감지하거나 직접 추가하세요.
        </div>
      ) : (
        state.buildTargets.targets.map((target) => (
          <BuildTargetRow
            key={target.id}
            projectId={projectId}
            target={target}
            status={state.getTargetStatus(target)}
            message={state.getTargetMessage(target)}
            error={state.getTargetError(target)}
            sdkName={state.registeredSdks.find((sdk) => sdk.id === target.buildProfile.sdkId)?.name}
            actionLocked={state.formMode !== null || state.editingTarget !== null || state.pipeline.isRunning}
            canDeepAnalyze={Boolean(onStartDeepAnalysis)}
            onOpenLog={state.setLogTarget}
            onDeepAnalyze={state.handleDeepAnalysis}
            onRetry={state.handleRetryTarget}
            onEdit={state.setEditingTarget}
            onDelete={state.setDeleteTarget}
          />
        ))
      )}

      <BuildTargetSectionSummary
        isRunning={state.pipeline.isRunning}
        targets={state.buildTargets.targets}
        readyTargets={state.readyTargets}
        readyCount={state.pipeline.readyCount}
        failedCount={state.pipeline.failedCount}
        totalCount={state.pipeline.totalCount}
        canDeepAnalyzeAll={Boolean(onStartDeepAnalysis)}
        onDeepAnalyzeAll={(buildTargetIds) => onStartDeepAnalysis?.(buildTargetIds)}
      />

      <ConfirmDialog
        open={state.deleteTarget !== null}
        title="빌드 타겟 삭제"
        message={state.deleteTarget ? `"${state.deleteTarget.name}" 타겟을 삭제하시겠습니까?` : ""}
        confirmLabel="삭제"
        danger
        onConfirm={() => state.deleteTarget && state.handleDelete(state.deleteTarget)}
        onCancel={() => state.setDeleteTarget(null)}
      />

      {state.logTarget && (
        <BuildLogViewer
          projectId={projectId}
          targetId={state.logTarget.id}
          targetName={state.logTarget.name}
          onClose={() => state.setLogTarget(null)}
        />
      )}

      {state.editingTarget && (
        <BuildTargetCreateDialog
          open
          projectId={projectId}
          sourceFiles={state.sourceFiles}
          onCancel={() => state.setEditingTarget(null)}
          title="빌드 타겟 수정"
          submitLabel="저장"
          initialName={state.editingTarget.name}
          initialProfile={state.editingTarget.buildProfile ?? DEFAULT_PROFILE}
          initialIncludedPaths={state.editingTarget.includedPaths ?? [state.editingTarget.relativePath]}
          includedPathsEditable={false}
          includedPathsHelpText={INCLUDED_PATHS_EDIT_GUARD_TEXT}
          onSubmit={state.handleEditSubmit}
        />
      )}
    </div>
  );
};
