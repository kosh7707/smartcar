import React from "react";
import type { BuildProfile } from "@aegis/shared";
import type { SourceFileEntry } from "../../../api/client";
import { BuildProfileForm } from "./BuildProfileForm";
import { formatFileSize } from "../../../utils/format";
import { Spinner } from "../../../shared/ui";
import { DEFAULT_PROFILE } from "../hooks/useBuildTargetSection";
import { INCLUDED_PATHS_EDIT_UNSUPPORTED_TEXT, useSubprojectCreateDialog } from "../hooks/useSubprojectCreateDialog";
import { SubprojectTreeSelector } from "./SubprojectTreeSelector";
import "./SubprojectCreateDialog.css";

interface Props {
  open: boolean;
  projectId: string;
  sourceFiles: SourceFileEntry[];
  onCancel: () => void;
  onCreated?: () => void;
  onSubmit?: (payload: { name: string; profile: BuildProfile; includedPaths: string[] }) => Promise<void>;
  title?: string;
  submitLabel?: string;
  initialName?: string;
  initialProfile?: BuildProfile;
  initialIncludedPaths?: string[];
  includedPathsEditable?: boolean;
  includedPathsHelpText?: string;
}

const EMPTY_INCLUDED_PATHS: string[] = [];

export const SubprojectCreateDialog: React.FC<Props> = ({
  open,
  projectId,
  sourceFiles,
  onCreated,
  onCancel,
  onSubmit,
  title = "서브 프로젝트 생성",
  submitLabel = "서브 프로젝트 생성",
  initialName = "",
  initialProfile = DEFAULT_PROFILE,
  initialIncludedPaths = EMPTY_INCLUDED_PATHS,
  includedPathsEditable = true,
  includedPathsHelpText = !includedPathsEditable ? INCLUDED_PATHS_EDIT_UNSUPPORTED_TEXT : undefined,
}) => {
  const {
    name,
    setName,
    checked,
    profile,
    setProfile,
    creating,
    registeredSdks,
    selectedCount,
    selectedSize,
    handleToggle,
    handleCreate,
  } = useSubprojectCreateDialog({
    open,
    projectId,
    sourceFiles,
    initialName,
    initialProfile,
    initialIncludedPaths,
    onCreated,
    onSubmit,
  });

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="card spcd" onClick={(event) => event.stopPropagation()}>
        <h3 className="confirm-dialog__title">{title}</h3>

        <div className="spcd__body">
          <label className="form-field">
            <span className="form-label">서브 프로젝트 이름</span>
            <input
              className="form-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: gateway-module"
              autoFocus
            />
          </label>

          <div>
            <span className="form-label">포함할 파일/폴더 선택</span>
            {includedPathsHelpText && (
              <div
                className="spcd__hint"
                role="note"
                style={{
                  marginTop: "var(--cds-spacing-02)",
                  marginBottom: "var(--cds-spacing-03)",
                  lineHeight: 1.5,
                }}
              >
                {includedPathsHelpText}
              </div>
            )}
            <SubprojectTreeSelector
              sourceFiles={sourceFiles}
              checked={checked}
              onToggle={handleToggle}
              disabled={!includedPathsEditable}
            />
          </div>

          <div className="spcd__summary">
            선택: <strong>{selectedCount}개 파일</strong>
            {selectedSize > 0 && <> · {formatFileSize(selectedSize)}</>}
          </div>

          <BuildProfileForm value={profile} onChange={setProfile} registeredSdks={registeredSdks} />
        </div>

        <div className="spcd__actions">
          <button className="btn btn-secondary" onClick={onCancel}>취소</button>
          <button className="btn" onClick={handleCreate} disabled={creating || selectedCount === 0}>
            {creating ? <Spinner size={14} /> : null}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
