import "./BuildTargetIncludedPathsField.css";
import React from "react";
import type { SourceFileEntry } from "@/common/api/client";
import { BuildTargetTreeSelector } from "../BuildTargetTreeSelector/BuildTargetTreeSelector";

interface BuildTargetIncludedPathsFieldProps {
  sourceFiles: SourceFileEntry[];
  checked: Set<string>;
  onToggle: (paths: string[], add: boolean) => void;
  disabled?: boolean;
  helpText?: string;
}

export const BuildTargetIncludedPathsField: React.FC<BuildTargetIncludedPathsFieldProps> = ({
  sourceFiles,
  checked,
  onToggle,
  disabled,
  helpText,
}) => (
  <div className="build-target-create-dialog__section">
    <span className="build-target-create-dialog__section-title">포함할 파일/폴더 선택</span>
    {helpText ? (
      <div className="build-target-create-dialog__help" role="note">
        {helpText}
      </div>
    ) : null}
    <BuildTargetTreeSelector
      sourceFiles={sourceFiles}
      checked={checked}
      onToggle={onToggle}
      disabled={disabled}
    />
  </div>
);
