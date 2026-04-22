import React from "react";
import type { BuildProfile } from "@aegis/shared";
import type { SourceFileEntry } from "../../../api/client";
import { BuildProfileForm } from "./BuildProfileForm";
import { formatFileSize } from "../../../utils/format";
import { Spinner, Modal } from "../../../shared/ui";
import { DEFAULT_PROFILE } from "../hooks/useBuildTargetSection";
import { INCLUDED_PATHS_EDIT_UNSUPPORTED_TEXT, useBuildTargetCreateDialog } from "../hooks/useBuildTargetCreateDialog";
import { BuildTargetTreeSelector } from "./BuildTargetTreeSelector";

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

export const BuildTargetCreateDialog: React.FC<Props> = ({
  open,
  projectId,
  sourceFiles,
  onCreated,
  onCancel,
  onSubmit,
  title = "BuildTarget 생성",
  submitLabel = "BuildTarget 생성",
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
  } = useBuildTargetCreateDialog({
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
    <Modal open onClose={onCancel} className="build-target-create-dialog" overlayClassName="confirm-overlay" >
        <header className="build-target-create-dialog__header">
          <h2>{title}</h2>
        </header>

        <div className="build-target-create-dialog__body">
          <label className="form-label build-target-create-dialog__field">
            <span>BuildTarget 이름</span>
            <input className="form-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: gateway-module"
              autoFocus
            />
          </label>

          <div className="build-target-create-dialog__section">
            <span className="build-target-create-dialog__section-title">포함할 파일/폴더 선택</span>
            {includedPathsHelpText ? (
              <div className="build-target-create-dialog__help" role="note">
                {includedPathsHelpText}
              </div>
            ) : null}
            <BuildTargetTreeSelector
              sourceFiles={sourceFiles}
              checked={checked}
              onToggle={handleToggle}
              disabled={!includedPathsEditable}
            />
          </div>

          <div className="build-target-create-dialog__selection-summary">
            선택: <strong className="build-target-create-dialog__selection-count">{selectedCount}개 파일</strong>
            {selectedSize > 0 ? <> · {formatFileSize(selectedSize)}</> : null}
          </div>

          <BuildProfileForm value={profile} onChange={setProfile} registeredSdks={registeredSdks} />
        </div>

        <footer className="build-target-create-dialog__footer">
          <button type="button" className="btn btn-outline" onClick={onCancel}>취소</button>
          <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={creating || selectedCount === 0}>
            {creating ? <Spinner size={14} /> : null}
            {submitLabel}
          </button>
        </footer>
      </Modal>
  );
};
