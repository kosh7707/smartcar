import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
        className="confirm-dialog"
        overlayClassName="confirm-overlay"
        onOverlayClick={onCancel}
        showCloseButton={false}
      >
        <DialogHeader className="confirm-dialog__header">
          <div className={cn("confirm-dialog__icon", danger ? "is-danger" : "is-default")}>
            <AlertTriangle size={17} />
          </div>
          <div className="confirm-dialog__copy">
            <DialogTitle className="confirm-dialog__title">{title}</DialogTitle>
            <DialogDescription className="confirm-dialog__description">
              {message}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="confirm-dialog__footer">
          <Button variant="outline" size="sm" onClick={onCancel}>
            취소
          </Button>
          <Button
            variant={danger ? "destructive" : "default"}
            size="sm"
            className={danger ? "confirm-dialog__btn--danger" : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
