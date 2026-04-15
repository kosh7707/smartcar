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

interface Props {
  open: boolean;
  targets: BuildTarget[];
  onConfirm: (selectedTargetId: string) => void;
  onCancel: () => void;
}

export const TargetSelectDialog: React.FC<Props> = ({ open, targets, onConfirm, onCancel }) => {
  const [selected, setSelected] = useState<string | null>(null);

  // Reset selection when dialog opens
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
        className="max-h-[80vh] max-w-[480px] gap-0 border-border bg-card p-0 shadow-2xl"
        overlayClassName="confirm-overlay"
        onOverlayClick={onCancel}
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>분석 대상 선택</DialogTitle>
          <DialogDescription>
            빠른 분석 또는 정밀 분석을 실행할 빌드 타겟 하나를 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto px-5 py-4" role="radiogroup" aria-label="분석 대상">
          {targets.map((t) => {
            const isSelected = selected === t.id;
            const sdkLabel = t.buildProfile.sdkId === "none" ? null : t.buildProfile.sdkId;
            return (
              <div
                key={t.id}
                className={`flex cursor-pointer items-center gap-4 rounded-lg px-4 py-3 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${isSelected ? "bg-primary/10 text-primary" : ""}`}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => chooseTarget(t.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseTarget(t.id); } }}
              >
                <div className={`flex size-[18px] shrink-0 items-center justify-center rounded-md border-2 transition-colors ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"}`}>
                  {isSelected && <Check size={12} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{t.name}</div>
                  <div className="truncate font-mono text-sm text-muted-foreground">{t.relativePath}</div>
                </div>
                {sdkLabel && <span className="shrink-0 text-sm text-muted-foreground">{sdkLabel}</span>}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
          <Button variant="outline" onClick={onCancel}>취소</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected}
          >
            <Play size={14} />
            분석 실행
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
