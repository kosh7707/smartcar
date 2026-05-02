import "./BuildTargetCreateDialog.css";
import React from "react";
import type { BuildProfile } from "@aegis/shared";
import type { SourceFileEntry } from "@/common/api/client";
import { Modal } from "@/common/ui/primitives";
import { DEFAULT_PROFILE, INCLUDED_PATHS_EDIT_UNSUPPORTED_TEXT, useBuildTargetCreateDialog } from "./useBuildTargetCreateDialog";
import { BuildProfileForm } from "./BuildProfileForm/BuildProfileForm";
import { BuildTargetNameField } from "./BuildTargetNameField/BuildTargetNameField";
import { BuildTargetIncludedPathsField } from "./BuildTargetIncludedPathsField/BuildTargetIncludedPathsField";
import { BuildTargetSelectionSummary } from "./BuildTargetSelectionSummary/BuildTargetSelectionSummary";
import { BuildTargetCreateDialogActions } from "./BuildTargetCreateDialogActions/BuildTargetCreateDialogActions";
import { BuildTargetCreateDialogHeader } from "./BuildTargetCreateDialogHeader/BuildTargetCreateDialogHeader";
import { BuildTargetCreateDialogBody } from "./BuildTargetCreateDialogBody/BuildTargetCreateDialogBody";

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
    <Modal open onClose={onCancel} className="build-target-create-dialog" overlayClassName="confirm-overlay">
      <BuildTargetCreateDialogHeader title={title} />
      <BuildTargetCreateDialogBody>
        <BuildTargetNameField value={name} onChange={setName} />
        <BuildTargetIncludedPathsField
          sourceFiles={sourceFiles}
          checked={checked}
          onToggle={handleToggle}
          disabled={!includedPathsEditable}
          helpText={includedPathsHelpText}
        />
        <BuildTargetSelectionSummary selectedCount={selectedCount} selectedSize={selectedSize} />
        <BuildProfileForm value={profile} onChange={setProfile} registeredSdks={registeredSdks} />
      </BuildTargetCreateDialogBody>
      <BuildTargetCreateDialogActions
        submitLabel={submitLabel}
        creating={creating}
        disabled={selectedCount === 0}
        onCancel={onCancel}
        onSubmit={handleCreate}
      />
    </Modal>
  );
};
