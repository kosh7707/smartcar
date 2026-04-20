import React, { useState, useCallback, useEffect } from "react";
import type { BuildTarget } from "@aegis/shared";
import { Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  targets: BuildTarget[];
  onConfirm: (selectedTargetId: string) => void;
  onCancel: () => void;
}

export const TargetSelectDialog: React.FC<Props> = ({ open, targets, onConfirm, onCancel }) => {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(targets[0]?.id ?? null);
    }
  }, [open, targets]);

  const chooseTarget = useCallback((id: string) => {
    setSelected(id);
  }, []);

  const handleConfirm = useCallback(() => {
    if (selected) onConfirm(selected);
  }, [selected, onConfirm]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <DialogContent
        className="target-select-dialog"
        overlayClassName="confirm-overlay"
        onOverlayClick={onCancel}
        showCloseButton={false}
      >
        <DialogHeader className="target-select-dialog__header">
          <DialogTitle>분석 대상 선택</DialogTitle>
          <DialogDescription>
            빠른 분석 또는 정밀 분석을 실행할 빌드 타겟 하나를 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="target-select-dialog__list" role="radiogroup" aria-label="분석 대상">
          {targets.map((target) => {
            const isSelected = selected === target.id;
            const sdkLabel = target.buildProfile.sdkId === "none" ? null : target.buildProfile.sdkId;
            return (
              <div
                key={target.id}
                className={cn("target-select-dialog__option", isSelected && "is-selected")}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => chooseTarget(target.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    chooseTarget(target.id);
                  }
                }}
              >
                <div className={cn("target-select-dialog__checkbox", isSelected && "is-selected")}>
                  {isSelected ? <Check size={12} /> : null}
                </div>
                <div className="target-select-dialog__option-copy">
                  <div className="target-select-dialog__option-title">{target.name}</div>
                  <div className="target-select-dialog__option-path">{target.relativePath}</div>
                </div>
                {sdkLabel ? <span className="target-select-dialog__option-sdk">{sdkLabel}</span> : null}
              </div>
            );
          })}
        </div>

        <DialogFooter className="target-select-dialog__footer">
          <Button variant="outline" onClick={onCancel}>취소</Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            <Play size={14} />
            분석 실행
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
