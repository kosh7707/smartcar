import React, { useEffect, useCallback } from "react";

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
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog card" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-dialog__title">{title}</h3>
        <p className="confirm-dialog__message">{message}</p>
        <div className="confirm-dialog__actions">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>
            취소
          </button>
          <button
            className={`btn btn-sm${danger ? " confirm-dialog__btn--danger" : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
