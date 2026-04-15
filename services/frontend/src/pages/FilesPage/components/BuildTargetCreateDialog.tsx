import React from "react";
import type { BuildProfile } from "@aegis/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceFileEntry } from "../../../api/client";
import { BuildProfileForm } from "./BuildProfileForm";
import { formatFileSize } from "../../../utils/format";
import { Spinner } from "../../../shared/ui";
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
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <DialogContent
        className="flex flex-col max-h-[85vh] max-w-[600px] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden border-border bg-card p-0 shadow-2xl sm:max-w-[600px]"
        overlayClassName="confirm-overlay"
        onOverlayClick={onCancel}
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Label className="flex-col items-start gap-2">
            <span>BuildTarget 이름</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: gateway-module"
              autoFocus
            />
          </Label>

          <div className="space-y-3">
            <span className="text-sm font-medium text-foreground">포함할 파일/폴더 선택</span>
            {includedPathsHelpText && (
              <div className="text-sm leading-6 text-muted-foreground" role="note">
                {includedPathsHelpText}
              </div>
            )}
            <BuildTargetTreeSelector
              sourceFiles={sourceFiles}
              checked={checked}
              onToggle={handleToggle}
              disabled={!includedPathsEditable}
            />
          </div>

          <div className="py-1 text-sm text-muted-foreground">
            선택: <strong className="font-semibold text-primary">{selectedCount}개 파일</strong>
            {selectedSize > 0 && <> · {formatFileSize(selectedSize)}</>}
          </div>

          <BuildProfileForm value={profile} onChange={setProfile} registeredSdks={registeredSdks} />
        </div>

        <DialogFooter className="flex-row justify-end gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
          <Button variant="outline" onClick={onCancel}>취소</Button>
          <Button onClick={handleCreate} disabled={creating || selectedCount === 0}>
            {creating ? <Spinner size={14} /> : null}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
