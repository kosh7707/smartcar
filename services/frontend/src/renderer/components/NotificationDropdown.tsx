import React, { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle, XCircle, ShieldX, ClipboardCheck, Upload, Package, Bell, X } from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { formatDateTime } from "../utils/format";
import type { NotificationType } from "@aegis/shared";
import "./NotificationDropdown.css";

const ICON_MAP: Record<NotificationType, React.ReactNode> = {
  critical_finding: <AlertTriangle size={14} className="text-danger" />,
  analysis_complete: <CheckCircle size={14} className="text-success" />,
  gate_failed: <ShieldX size={14} className="text-warning" />,
  approval_pending: <ClipboardCheck size={14} className="text-accent" />,
  upload_complete: <Upload size={14} className="text-success" />,
  upload_failed: <XCircle size={14} className="text-danger" />,
  sdk_ready: <Package size={14} className="text-success" />,
  sdk_failed: <XCircle size={14} className="text-danger" />,
  pipeline_complete: <CheckCircle size={14} className="text-success" />,
  pipeline_failed: <XCircle size={14} className="text-danger" />,
};

interface NotificationDropdownProps {
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose }) => {
  const { notifications, markRead, markAllRead } = useNotifications();
  const visibleNotifications = notifications.slice(0, 20);
  const hasUnread = visibleNotifications.some((n) => !n.read);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid catching the bell click that opened us
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const handleItemClick = async (id: string) => {
    await markRead(id);
    onClose();
  };

  return (
    <div className="notification-dropdown" ref={dropdownRef}>
      {/* Caret arrow */}
      <div className="notification-dropdown__caret" />

      <div className="notification-dropdown__header">
        <h4>알림</h4>
        <div className="notification-dropdown__header-actions">
          {hasUnread && (
            <button className="notification-dropdown__mark-all" onClick={markAllRead}>
              모두 읽음
            </button>
          )}
          <button className="notification-dropdown__close" onClick={onClose} aria-label="닫기">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="notification-dropdown__list">
        {visibleNotifications.length === 0 ? (
          <div className="notification-dropdown__empty">
            <Bell size={32} className="notification-dropdown__empty-icon" />
            <span className="notification-dropdown__empty-title">새 알림이 없습니다</span>
            <span className="notification-dropdown__empty-desc">
              분석 완료, 승인 요청 등의 알림이 여기에 표시됩니다.
            </span>
          </div>
        ) : (
          visibleNotifications.map((n) => (
            <div
              key={n.id}
              className={`notification-item${n.read ? "" : " notification-item--unread"}`}
              onClick={() => handleItemClick(n.id)}
            >
              <div className="notification-item__icon">
                {ICON_MAP[n.type] ?? <CheckCircle size={14} />}
              </div>
              <div className="notification-item__body">
                <p className="notification-item__title">{n.title}</p>
                <p className="notification-item__text">{n.body}</p>
                <span className="notification-item__time">{formatDateTime(n.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
