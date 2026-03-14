import React, { useState, useEffect, useCallback } from "react";
import type { FindingStatus, FindingSourceType } from "@smartcar/shared";
import {
  FINDING_STATUS_LABELS,
  ALLOWED_TRANSITIONS,
  canTransitionTo,
} from "../../constants/finding";
import "./StateTransitionDialog.css";

interface Props {
  open: boolean;
  currentStatus: FindingStatus;
  sourceType: FindingSourceType;
  onConfirm: (newStatus: FindingStatus, reason: string) => void;
  onCancel: () => void;
}

export const StateTransitionDialog: React.FC<Props> = ({
  open,
  currentStatus,
  sourceType,
  onConfirm,
  onCancel,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<FindingStatus | "">("");
  const [reason, setReason] = useState("");

  const availableTransitions = ALLOWED_TRANSITIONS[currentStatus].filter((to) =>
    canTransitionTo(currentStatus, to, sourceType),
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedStatus("");
      setReason("");
    }
  }, [open]);

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

  const canSubmit = selectedStatus !== "" && reason.trim().length > 0;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog card state-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-dialog__title">상태 변경</h3>

        <div className="state-dialog__field">
          <label className="state-dialog__label">현재 상태</label>
          <span className={`badge badge-status--${currentStatus}`}>
            {FINDING_STATUS_LABELS[currentStatus]}
          </span>
        </div>

        <div className="state-dialog__field">
          <label className="state-dialog__label" htmlFor="state-select">새 상태</label>
          <select
            id="state-select"
            className="form-input state-dialog__select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as FindingStatus)}
          >
            <option value="">선택하세요</option>
            {availableTransitions.map((s) => (
              <option key={s} value={s}>
                {FINDING_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="state-dialog__field">
          <label className="state-dialog__label" htmlFor="state-reason">사유</label>
          <textarea
            id="state-reason"
            className="form-input state-dialog__textarea"
            rows={3}
            placeholder="상태 변경 사유를 입력하세요 (필수)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="confirm-dialog__actions">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>
            취소
          </button>
          <button
            className="btn btn-sm"
            disabled={!canSubmit}
            onClick={() => {
              if (canSubmit) onConfirm(selectedStatus as FindingStatus, reason.trim());
            }}
          >
            변경
          </button>
        </div>
      </div>
    </div>
  );
};
