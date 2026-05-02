import "./BuildTargetCreateDialogActions.css";
import React from "react";
import { Spinner } from "@/common/ui/primitives";

interface BuildTargetCreateDialogActionsProps {
  submitLabel: string;
  creating: boolean;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export const BuildTargetCreateDialogActions: React.FC<BuildTargetCreateDialogActionsProps> = ({
  submitLabel,
  creating,
  disabled,
  onCancel,
  onSubmit,
}) => (
  <footer className="build-target-create-dialog__footer">
    <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
      취소
    </button>
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={onSubmit}
      disabled={creating || disabled}
    >
      {creating ? <Spinner size={14} /> : null}
      {submitLabel}
    </button>
  </footer>
);
