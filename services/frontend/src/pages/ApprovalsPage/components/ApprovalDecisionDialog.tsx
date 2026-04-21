import React from "react";
import { Modal } from "../../../shared/ui";
import type { ApprovalDecisionAction } from "../hooks/useApprovalsPage";

interface ApprovalDecisionDialogProps {
  action: ApprovalDecisionAction;
  comment: string;
  processing: boolean;
  onClose: () => void;
  onCommentChange: (value: string) => void;
  onConfirm: () => void;
}

export const ApprovalDecisionDialog: React.FC<ApprovalDecisionDialogProps> = ({
  action,
  comment,
  processing,
  onClose,
  onCommentChange,
  onConfirm,
}) => {
  const isReject = action === "rejected";
  const title = isReject ? "거부 확인" : "승인 확인";
  const confirmLabel = processing ? "처리 중..." : isReject ? "거부" : "승인";

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="approval-decision-title"
      describedBy="approval-decision-desc"
      className="approval-decision-dialog"
    >
      <header className="approval-decision-dialog__header">
        <h2 id="approval-decision-title" className="approval-decision-dialog__title">
          {title}
        </h2>
        <p id="approval-decision-desc" className="approval-decision-dialog__description">
          결정 사유를 남기면 이후 감사 추적과 승인 이력 검토에 도움이 됩니다.
        </p>
      </header>
      <div className="approval-decision-dialog__body">
        <textarea
          className="approval-decision-dialog__textarea"
          rows={4}
          placeholder="코멘트 (선택)"
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
        />
      </div>
      <footer className="approval-decision-dialog__footer">
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className={`btn btn-sm ${isReject ? "btn-danger" : "btn-primary"}`}
          onClick={onConfirm}
          disabled={processing}
        >
          {confirmLabel}
        </button>
      </footer>
    </Modal>
  );
};
