import React from "react";
import { AlertTriangle, CheckCircle, ShieldX, ClipboardCheck } from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { formatDateTime } from "../utils/format";
import type { NotificationType } from "@aegis/shared";
import "./NotificationDropdown.css";

const ICON_MAP: Record<NotificationType, React.ReactNode> = {
  critical_finding: <AlertTriangle size={16} className="text-danger" />,
  analysis_complete: <CheckCircle size={16} className="text-success" />,
  gate_failed: <ShieldX size={16} className="text-warning" />,
  approval_pending: <ClipboardCheck size={16} className="text-accent" />,
};

interface NotificationDropdownProps {
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose }) => {
  const { notifications, markRead, markAllRead } = useNotifications();
  const visibleNotifications = notifications.slice(0, 20);

  const handleItemClick = async (id: string) => {
    await markRead(id);
    onClose();
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  return (
    <div className="notification-dropdown">
      <div className="notification-dropdown__header">
        <h4>알림</h4>
        <button className="notification-dropdown__mark-all" onClick={handleMarkAllRead}>
          모두 읽음
        </button>
      </div>

      <div className="notification-dropdown__list">
        {visibleNotifications.length === 0 ? (
          <div className="notification-dropdown__empty">알림이 없습니다</div>
        ) : (
          visibleNotifications.map((n) => (
            <div
              key={n.id}
              className={`notification-item${n.read ? "" : " notification-item--unread"}`}
              onClick={() => handleItemClick(n.id)}
            >
              <div className="notification-item__icon">
                {ICON_MAP[n.type] ?? <CheckCircle size={16} />}
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
