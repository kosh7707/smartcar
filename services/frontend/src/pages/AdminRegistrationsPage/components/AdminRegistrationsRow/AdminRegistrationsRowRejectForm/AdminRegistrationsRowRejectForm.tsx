import "./AdminRegistrationsRowRejectForm.css";
import React from "react";

interface AdminRegistrationsRowRejectFormProps {
  reason: string;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: "approve" | "reject";
}

export const AdminRegistrationsRowRejectForm: React.FC<AdminRegistrationsRowRejectFormProps> = ({
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
  busy,
}) => {
  const isBusy = busy !== undefined;
  return (
    <div className="admin-reg-reject">
      <textarea
        className="admin-reg-reject__textarea"
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        placeholder="반려 사유를 입력하세요 (신청자에게 보관용으로 남습니다)"
        rows={3}
        disabled={isBusy}
        spellCheck={false}
      />
      <div className="admin-reg-reject__actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={isBusy}>
          취소
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={onConfirm}
          disabled={isBusy || !reason.trim()}
        >
          {busy === "reject" ? "반려 중..." : "반려 확정"}
        </button>
      </div>
    </div>
  );
};
