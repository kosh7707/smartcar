import React, { useState, useCallback } from "react";
import type { BuildProfile, BuildTarget } from "@aegis/shared";
import { Crosshair, Plus, Pencil, Trash2 } from "lucide-react";
import { useBuildTargets } from "../../hooks/useBuildTargets";
import { useToast } from "../../contexts/ToastContext";
import { logError } from "../../api/client";
import { ConfirmDialog, Spinner } from "../ui";
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

interface Props {
  projectId: string;
}

export const BuildTargetSection: React.FC<Props> = ({ projectId }) => {
  const toast = useToast();
  const bt = useBuildTargets(projectId);

  // Form state
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPath, setFormPath] = useState("");
  const [formProfile, setFormProfile] = useState<BuildProfile>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);

  // Delete confirm
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
    if (!formName.trim()) {
      toast.error("타겟 이름을 입력해주세요.");
      return;
    }
    if (formMode === "add" && !formPath.trim()) {
      toast.error("상대 경로를 입력해주세요.");
      return;
    }
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
    } catch {
      toast.error("타겟 탐색에 실패했습니다.");
    }
  }, [bt, toast]);

  return (
    <div className="card gs-card">
      <div className="gs-card__header">
        <div className="gs-card__icon"><Crosshair size={18} /></div>
        <div>
          <div className="gs-card__title">빌드 타겟</div>
          <div className="gs-card__desc">
            프로젝트 내 독립 빌드 단위를 관리합니다. 타겟별로 SDK와 컴파일러 설정을 지정할 수 있습니다.
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="bt-actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleDiscover}
          disabled={bt.discovering}
        >
          {bt.discovering ? <Spinner size={14} /> : <Crosshair size={14} />}
          타겟 탐색
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={openAddForm}
          disabled={formMode !== null}
        >
          <Plus size={14} />
          타겟 추가
        </button>
      </div>

      {/* Add form */}
      {formMode === "add" && (
        <div className="bt-form">
          <div className="bt-form__grid">
            <label className="form-field">
              <span className="form-label">타겟 이름</span>
              <input
                className="form-input"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="gateway"
                autoFocus
              />
            </label>
            <label className="form-field">
              <span className="form-label">상대 경로</span>
              <input
                className="form-input font-mono"
                value={formPath}
                onChange={(e) => setFormPath(e.target.value)}
                placeholder="gateway/"
                spellCheck={false}
              />
            </label>
          </div>
          <BuildProfileForm value={formProfile} onChange={setFormProfile} />
          <div className="bt-form__actions">
            <button className="btn btn-secondary btn-sm" onClick={closeForm}>취소</button>
            <button className="btn btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "저장 중..." : "추가"}
            </button>
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
          const sdk = getSdkProfile(target.buildProfile.sdkId);

          // Inline edit form
          if (formMode === "edit" && editingId === target.id) {
            return (
              <div key={target.id} className="bt-form">
                <div className="bt-form__grid">
                  <label className="form-field">
                    <span className="form-label">타겟 이름</span>
                    <input
                      className="form-input"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      autoFocus
                    />
                  </label>
                  <label className="form-field">
                    <span className="form-label">상대 경로</span>
                    <input
                      className="form-input font-mono"
                      value={formPath}
                      disabled
                      spellCheck={false}
                    />
                  </label>
                </div>
                <BuildProfileForm value={formProfile} onChange={setFormProfile} />
                <div className="bt-form__actions">
                  <button className="btn btn-secondary btn-sm" onClick={closeForm}>취소</button>
                  <button className="btn btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={target.id} className="bt-row">
              <div className="bt-row__body">
                <div className="bt-row__name">{target.name}</div>
                <div className="bt-row__meta">
                  <span className="bt-path">{target.relativePath}</span>
                  {sdk && <span className="bt-sdk">{sdk.name}</span>}
                  {target.buildSystem && <span className="bt-build-sys">{target.buildSystem}</span>}
                </div>
              </div>
              <div className="bt-row__actions">
                <button
                  className="btn-icon"
                  title="편집"
                  onClick={() => openEditForm(target)}
                  disabled={formMode !== null}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="btn-icon btn-danger"
                  title="삭제"
                  onClick={() => setDeleteTarget(target)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })
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
