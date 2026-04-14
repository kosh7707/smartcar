import React from "react";
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
}) => (
  <div className="confirm-overlay" role="presentation" onClick={onClose}>
    <div className="confirm-dialog card approval-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
      <h3 className="confirm-dialog__title">{action === "approved" ? "승인 확인" : "거부 확인"}</h3>
      <p className="approval-dialog__subtitle">결정 사유를 남기면 이후 감사 추적과 승인 이력 검토에 도움이 됩니다.</p>
      <textarea
        className="input approval-dialog__comment-input"
        rows={4}
        placeholder="코멘트 (선택)"
        value={comment}
        onChange={(event) => onCommentChange(event.target.value)}
      />
      <div className="confirm-dialog__actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className={`btn btn-sm${action === "rejected" ? " confirm-dialog__btn--cds-support-error" : ""}`}
          onClick={onConfirm}
          disabled={processing}
        >
          {processing ? "처리 중..." : action === "approved" ? "승인" : "거부"}
        </button>
      </div>
    </div>
  </div>
);
