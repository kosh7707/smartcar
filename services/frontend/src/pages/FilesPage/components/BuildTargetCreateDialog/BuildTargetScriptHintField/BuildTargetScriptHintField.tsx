import "./BuildTargetScriptHintField.css";
import React from "react";
import { X } from "lucide-react";
import type { SourceFileEntry } from "@/common/api/client";
import { BuildTargetScriptHintTree } from "../BuildTargetScriptHintTree/BuildTargetScriptHintTree";

interface BuildTargetScriptHintFieldProps {
  sourceFiles: SourceFileEntry[];
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
  buildTargetRoot: string;
  disabled?: boolean;
  helpText?: string;
}

export function deriveRootRelative(uploadedPath: string | null, buildTargetRoot: string): string | null {
  if (!uploadedPath) return null;
  if (!buildTargetRoot) return uploadedPath;
  const root = buildTargetRoot.endsWith("/") ? buildTargetRoot : `${buildTargetRoot}/`;
  if (uploadedPath.startsWith(root)) return uploadedPath.slice(root.length);
  return null;
}

const DEFAULT_HELP_TEXT = "S3 빌드 에이전트가 참고할 업로드 파일을 1개 선택할 수 있습니다 (선택 사항). BuildTarget 루트 기준 상대 경로로 저장됩니다.";

export const BuildTargetScriptHintField: React.FC<BuildTargetScriptHintFieldProps> = ({
  sourceFiles,
  selectedPath,
  onSelect,
  buildTargetRoot,
  disabled,
  helpText = DEFAULT_HELP_TEXT,
}) => {
  const rootRelative = deriveRootRelative(selectedPath, buildTargetRoot);
  const showRootMismatch = selectedPath !== null && rootRelative === null;

  return (
    <div className="build-target-create-dialog__section">
      <span className="build-target-create-dialog__section-title">빌드 스크립트 힌트 (선택)</span>
      <div className="build-target-create-dialog__help" role="note">{helpText}</div>

      {selectedPath ? (
        <div className="script-hint-field__selected" data-testid="script-hint-selected">
          <div className="script-hint-field__selected-meta">
            <span className="script-hint-field__selected-label">선택된 파일</span>
            <code className="script-hint-field__selected-path">{selectedPath}</code>
            {rootRelative ? (
              <span className="script-hint-field__selected-relative">
                저장 경로: <code>{rootRelative}</code>
              </span>
            ) : null}
            {showRootMismatch ? (
              <span className="script-hint-field__selected-warning" role="alert">
                선택한 파일이 BuildTarget 루트(<code>{buildTargetRoot || "(미정)"}</code>) 밖에 있어 저장 시 거부될 수 있습니다.
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="script-hint-field__clear"
            onClick={() => onSelect(null)}
            disabled={disabled}
            aria-label="선택 해제"
            title="선택 해제"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="script-hint-field__placeholder">선택된 파일 없음</div>
      )}

      <BuildTargetScriptHintTree
        sourceFiles={sourceFiles}
        selectedPath={selectedPath}
        onSelect={onSelect}
        disabled={disabled}
      />
    </div>
  );
};
