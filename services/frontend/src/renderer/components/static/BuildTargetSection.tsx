import React, { useState, useCallback } from "react";
import type { BuildProfile, BuildTarget } from "@aegis/shared";
import { Crosshair, Plus, Pencil, Trash2, Play, RotateCcw, Bot } from "lucide-react";
import { useBuildTargets } from "../../hooks/useBuildTargets";
import { usePipelineProgress } from "../../hooks/usePipelineProgress";
import { useToast } from "../../contexts/ToastContext";
import { logError } from "../../api/client";
import { ConfirmDialog, Spinner, TargetStatusBadge, TargetProgressStepper } from "../ui";
import { BuildProfileForm } from "./BuildProfileForm";
import { getSdkProfile } from "../../constants/sdkProfiles";
import "./BuildTargetSection.css";

const DEFAULT_PROFILE: BuildProfile = {
  sdkId: "generic-linux",
  compiler: "gcc",
  targetArch: "x86_64",
  languageStandard: "c17",
  headerLanguage: "auto",
};

const FAILED_STATUSES = new Set(["build_failed", "scan_failed", "graph_failed"]);
const RUNNING_STATUSES = new Set(["building", "scanning", "graphing"]);

interface Props {
  projectId: string;
  onStartDeepAnalysis?: (targetIds: string[]) => void;
}

export const BuildTargetSection: React.FC<Props> = ({ projectId, onStartDeepAnalysis }) => {
  const toast = useToast();
  const bt = useBuildTargets(projectId);
  const pipeline = usePipelineProgress();

  // Form state
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPath, setFormPath] = useState("");
  const [formProfile, setFormProfile] = useState<BuildProfile>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BuildTarget | null>(null);

  const openAddForm = useCallback(() => {
    setFormMode("add");
    setEditingId(null);
    setFormName("");
    setFormPath("");
    setFormProfile(DEFAULT_PROFILE);
  }, []);

  const openEditForm = useCallback((target: BuildTarget) => {
    setFormMode("edit");
    setEditingId(target.id);
    setFormName(target.name);
    setFormPath(target.relativePath);
    setFormProfile(target.buildProfile);
  }, []);

  const closeForm = useCallback(() => {
    setFormMode(null);
    setEditingId(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formName.trim()) { toast.error("타겟 이름을 입력해주세요."); return; }
    if (formMode === "add" && !formPath.trim()) { toast.error("상대 경로를 입력해주세요."); return; }
    setSaving(true);
    try {
      if (formMode === "add") {
        await bt.add(formName.trim(), formPath.trim(), formProfile);
        toast.success(`타겟 "${formName.trim()}" 추가됨`);
      } else if (formMode === "edit" && editingId) {
        await bt.update(editingId, { name: formName.trim(), buildProfile: formProfile });
        toast.success(`타겟 "${formName.trim()}" 수정됨`);
      }
      closeForm();
    } catch (e) {
      logError("Save build target", e);
      toast.error("타겟 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [formMode, formName, formPath, formProfile, editingId, bt, toast, closeForm]);

  const handleDelete = useCallback(async (target: BuildTarget) => {
    try {
      await bt.remove(target.id);
      toast.success(`타겟 "${target.name}" 삭제됨`);
    } catch (e) {
      logError("Delete build target", e);
      toast.error("타겟 삭제에 실패했습니다.");
    }
    setDeleteTarget(null);
  }, [bt, toast]);

  const handleDiscover = useCallback(async () => {
    try {
      const discovered = await bt.discover();
      toast.success(`${discovered.length}개 빌드 타겟 발견`);
    } catch { toast.error("타겟 탐색에 실패했습니다."); }
  }, [bt, toast]);

  const handleRunPipeline = useCallback(async () => {
    try {
      await pipeline.startPipeline(projectId);
      toast.success("빌드 & 분석 파이프라인 시작");
    } catch { toast.error("파이프라인 실행에 실패했습니다."); }
  }, [pipeline, projectId, toast]);

  const handleRetryTarget = useCallback(async (targetId: string) => {
    try {
      await pipeline.retryTarget(projectId, targetId);
      toast.success("재실행 시작");
    } catch { toast.error("재실행에 실패했습니다."); }
  }, [pipeline, projectId, toast]);

  const handleDeepAnalysis = useCallback((targetId: string) => {
    onStartDeepAnalysis?.([targetId]);
  }, [onStartDeepAnalysis]);

  // Merge pipeline WS state with stored target status
  const getTargetStatus = (target: BuildTarget): string => {
    const wsState = pipeline.targets.get(target.id);
    return wsState?.status ?? target.status ?? "discovered";
  };

  const getTargetMessage = (target: BuildTarget): string | undefined => {
    return pipeline.targets.get(target.id)?.message;
  };

  const getTargetError = (target: BuildTarget): string | undefined => {
    return pipeline.targets.get(target.id)?.error;
  };

  const readyTargets = bt.targets.filter((t) => getTargetStatus(t) === "ready");
  const configuredCount = bt.targets.filter((t) => {
    const s = getTargetStatus(t);
    return s !== "discovered";
  }).length;

  return (
    <div className="card gs-card">
      <div className="gs-card__header">
        <div className="gs-card__icon"><Crosshair size={18} /></div>
        <div>
          <div className="gs-card__title">서브 프로젝트</div>
          <div className="gs-card__desc">
            프로젝트 내 독립 빌드 단위를 관리합니다. 타겟별로 SDK 설정 후 빌드 & 분석을 실행하세요.
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="bt-actions">
        <button className="btn btn-secondary btn-sm" onClick={handleDiscover} disabled={bt.discovering || pipeline.isRunning}>
          {bt.discovering ? <Spinner size={14} /> : <Crosshair size={14} />}
          타겟 탐색
        </button>
        <button className="btn btn-secondary btn-sm" onClick={openAddForm} disabled={formMode !== null || pipeline.isRunning}>
          <Plus size={14} />
          타겟 추가
        </button>
        {bt.targets.length > 0 && (
          <button
            className="btn btn-sm"
            onClick={handleRunPipeline}
            disabled={pipeline.isRunning || configuredCount === 0}
          >
            {pipeline.isRunning ? <Spinner size={14} /> : <Play size={14} />}
            빌드 & 분석 실행
          </button>
        )}
      </div>

      {/* Add form */}
      {formMode === "add" && (
        <div className="bt-form">
          <div className="bt-form__grid">
            <label className="form-field">
              <span className="form-label">타겟 이름</span>
              <input className="form-input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="gateway" autoFocus />
            </label>
            <label className="form-field">
              <span className="form-label">상대 경로</span>
              <input className="form-input font-mono" value={formPath} onChange={(e) => setFormPath(e.target.value)} placeholder="gateway/" spellCheck={false} />
            </label>
          </div>
          <BuildProfileForm value={formProfile} onChange={setFormProfile} />
          <div className="bt-form__actions">
            <button className="btn btn-secondary btn-sm" onClick={closeForm}>취소</button>
            <button className="btn btn-sm" onClick={handleSave} disabled={saving}>{saving ? "저장 중..." : "추가"}</button>
          </div>
        </div>
      )}

      {/* Target list */}
      {bt.loading ? (
        <div className="bt-empty"><Spinner size={20} label="로딩 중..." /></div>
      ) : bt.targets.length === 0 && formMode !== "add" ? (
        <div className="bt-empty">
          아직 빌드 타겟이 없습니다. "타겟 탐색"으로 자동 감지하거나 직접 추가하세요.
        </div>
      ) : (
        bt.targets.map((target) => {
          const status = getTargetStatus(target);
          const message = getTargetMessage(target);
          const error = getTargetError(target);
          const sdk = getSdkProfile(target.buildProfile.sdkId);
          const isFailed = FAILED_STATUSES.has(status);
          const isRunning = RUNNING_STATUSES.has(status);
          const isReady = status === "ready";

          // Inline edit form
          if (formMode === "edit" && editingId === target.id) {
            return (
              <div key={target.id} className="bt-form">
                <div className="bt-form__grid">
                  <label className="form-field">
                    <span className="form-label">타겟 이름</span>
                    <input className="form-input" value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />
                  </label>
                  <label className="form-field">
                    <span className="form-label">상대 경로</span>
                    <input className="form-input font-mono" value={formPath} disabled spellCheck={false} />
                  </label>
                </div>
                <BuildProfileForm value={formProfile} onChange={setFormProfile} />
                <div className="bt-form__actions">
                  <button className="btn btn-secondary btn-sm" onClick={closeForm}>취소</button>
                  <button className="btn btn-sm" onClick={handleSave} disabled={saving}>{saving ? "저장 중..." : "저장"}</button>
                </div>
              </div>
            );
          }

          return (
            <div key={target.id} className={`bt-row${isFailed ? " bt-row--failed" : isReady ? " bt-row--ready" : ""}`}>
              <div className="bt-row__body">
                <div className="bt-row__name-line">
                  <span className="bt-row__name">{target.name}</span>
                  <TargetStatusBadge status={status} size="sm" />
                </div>
                <div className="bt-row__meta">
                  <span className="bt-path">{target.relativePath}</span>
                  {sdk && <span className="bt-sdk">{sdk.name}</span>}
                  {target.buildSystem && <span className="bt-build-sys">{target.buildSystem}</span>}
                </div>
                {status !== "discovered" && (
                  <div className="bt-row__stepper">
                    <TargetProgressStepper
                      status={status}
                      message={isFailed && error ? error : isRunning ? message : undefined}
                    />
                  </div>
                )}
              </div>
              <div className="bt-row__actions">
                {isReady && onStartDeepAnalysis && (
                  <button className="btn btn-sm" onClick={() => handleDeepAnalysis(target.id)} title="심층 분석">
                    <Bot size={14} />
                  </button>
                )}
                {isFailed && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleRetryTarget(target.id)} title="재실행">
                    <RotateCcw size={14} />
                  </button>
                )}
                <button
                  className="btn-icon"
                  title="편집"
                  onClick={() => openEditForm(target)}
                  disabled={formMode !== null || pipeline.isRunning}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="btn-icon btn-danger"
                  title="삭제"
                  onClick={() => setDeleteTarget(target)}
                  disabled={pipeline.isRunning}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Pipeline progress summary */}
      {pipeline.isRunning && bt.targets.length > 0 && (
        <div className="bt-progress-summary">
          <Spinner size={14} />
          <span>파이프라인 진행 중...</span>
          {pipeline.totalCount > 0 && (
            <span className="bt-progress-counts">
              {pipeline.readyCount}/{pipeline.totalCount} 완료
              {pipeline.failedCount > 0 && <span className="bt-progress-failed"> · {pipeline.failedCount} 실패</span>}
            </span>
          )}
        </div>
      )}

      {/* Ready summary */}
      {!pipeline.isRunning && readyTargets.length > 0 && onStartDeepAnalysis && (
        <div className="bt-ready-summary">
          <span>{readyTargets.length}개 서브 프로젝트 분석 준비 완료</span>
          <button className="btn btn-sm" onClick={() => onStartDeepAnalysis(readyTargets.map((t) => t.id))}>
            <Bot size={14} />
            전체 심층 분석
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="빌드 타겟 삭제"
        message={deleteTarget ? `"${deleteTarget.name}" 타겟을 삭제하시겠습니까?` : ""}
        confirmLabel="삭제"
        danger
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
