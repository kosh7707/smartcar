import React, { useState, useEffect } from "react";
import type { FindingStatus, FindingSourceType } from "@aegis/shared";
import {
  FINDING_STATUS_LABELS,
  ALLOWED_TRANSITIONS,
  canTransitionTo,
} from "@/common/constants/finding";
import { findingStatusBadgeClass } from "./FindingStatusBadge";
import { Modal } from "./Modal";
import { SelectField } from "./SelectField";
import { TextareaField } from "./TextareaField";
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

  useEffect(() => {
    if (open) {
      setSelectedStatus("");
      setReason("");
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = selectedStatus !== "" && reason.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="state-transition-title"
      describedBy="state-transition-desc"
      className="state-transition-dialog"
    >
      <header className="state-transition-dialog__header">
        <h2 id="state-transition-title" className="state-transition-dialog__title">
          상태 변경
        </h2>
        <p id="state-transition-desc" className="state-transition-dialog__description">
          탐지 항목의 상태를 바꾸려면 새 상태와 변경 사유를 남기세요.
        </p>
      </header>

      <div className="state-transition-dialog__body">
        <div className="state-transition-dialog__field">
          <span className="form-label">현재 상태</span>
          <span
            className={`${findingStatusBadgeClass(currentStatus)} state-transition-dialog__status`}
          >
            {FINDING_STATUS_LABELS[currentStatus]}
          </span>
        </div>

        <SelectField
          label="새 상태"
          name="state-select"
          id="state-select"
          value={selectedStatus}
          onValueChange={(nextStatus) => setSelectedStatus(nextStatus as FindingStatus)}
          placeholder="선택하세요"
          options={availableTransitions.map((status) => ({
            value: status,
            label: FINDING_STATUS_LABELS[status],
          }))}
        />

        <TextareaField
          label="사유"
          name="state-reason"
          id="state-reason"
          rows={3}
          placeholder="상태 변경 사유를 입력하세요 (필수)"
          value={reason}
          onChange={(value) => setReason(value)}
          required
        />
      </div>

      <footer className="state-transition-dialog__footer">
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!canSubmit}
          onClick={() => {
            if (canSubmit) onConfirm(selectedStatus as FindingStatus, reason.trim());
          }}
        >
          변경
        </button>
      </footer>
    </Modal>
  );
};
