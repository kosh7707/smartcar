import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/common/utils/cn";
import { Modal } from "./Modal";

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
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="confirm-dialog-title"
      describedBy="confirm-dialog-desc"
      className="confirm-dialog"
      overlayClassName="confirm-overlay"
    >
      <header className="confirm-dialog__header">
        <div className={cn("confirm-dialog__icon", danger ? "is-danger" : "is-default")}>
          <AlertTriangle size={17} aria-hidden="true" />
        </div>
        <div className="confirm-dialog__copy">
          <h2 id="confirm-dialog-title" className="confirm-dialog__title">
            {title}
          </h2>
          <p id="confirm-dialog-desc" className="confirm-dialog__description">
            {message}
          </p>
        </div>
      </header>
      <footer className="confirm-dialog__footer">
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
          취소
        </button>
        <button className={cn("btn btn-primary btn-sm", "btn btn-sm",
            danger ? "btn-danger confirm-dialog__btn--danger" : "btn-primary",)}
          type="button"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </footer>
    </Modal>
  );
};
