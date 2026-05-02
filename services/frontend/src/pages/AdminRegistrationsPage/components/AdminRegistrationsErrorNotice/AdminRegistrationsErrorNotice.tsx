import "./AdminRegistrationsErrorNotice.css";
import React from "react";
import { AlertCircle } from "lucide-react";

interface AdminRegistrationsErrorNoticeProps {
  message: string;
  onClose?: () => void;
}

export const AdminRegistrationsErrorNotice: React.FC<AdminRegistrationsErrorNoticeProps> = ({ message, onClose }) => (
  <div className="admin-reg-notice" role="alert">
    <AlertCircle size={16} aria-hidden="true" />
    <div className="admin-reg-notice__body">{message}</div>
    {onClose ? (
      <button type="button" className="btn btn-ghost btn-sm admin-reg-notice__close" onClick={onClose}>
        닫기
      </button>
    ) : null}
  </div>
);
