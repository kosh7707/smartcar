import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = "확인",
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <DialogContent
        className="confirm-dialog max-w-md gap-0 border-border bg-card p-0 shadow-2xl sm:max-w-md"
        overlayClassName="confirm-overlay"
        onOverlayClick={onCancel}
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-start gap-3 space-y-0 border-b border-border px-5 py-4">
          <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            <AlertTriangle size={17} />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6 text-muted-foreground">
              {message}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2 rounded-b-xl border-t-0 bg-transparent px-5 py-4">
          <Button variant="outline" size="sm" onClick={onCancel}>
            취소
          </Button>
          <Button
            variant={danger ? "destructive" : "default"}
            size="sm"
            className={danger ? "confirm-dialog__btn--danger" : ""}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
