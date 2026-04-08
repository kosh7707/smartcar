import React, { useState, useEffect, useRef } from "react";
import { Bell, User as UserIcon } from "lucide-react";
import { healthCheck } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { NotificationDropdown } from "./NotificationDropdown";
import { POLL_HEALTH_MS } from "../constants/defaults";
import { formatUptime } from "../utils/format";
import "./StatusBar.css";

/** Inner bell component that assumes NotificationProvider is present. */
const NotificationBellInner: React.FC = () => {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="statusbar__notifications" style={{ position: "relative" }}>
      <button
        className="statusbar__bell"
        onClick={() => setOpen((v) => !v)}
        title="알림"
        aria-label={`알림 ${unreadCount > 0 ? `${unreadCount}건 미확인` : ""}`}
      >
        <Bell size={14} />
        {unreadCount > 0 && <span className="statusbar__bell-badge">{unreadCount}</span>}
      </button>
      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  );
};

/** Error boundary that silently swallows render errors (used to guard optional context consumers). */
class SafeBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? null : this.props.children; }
}

/** Notification bell wrapped in an error boundary so it renders nothing when NotificationProvider is absent. */
const NotificationBell: React.FC = () => (
  <SafeBoundary><NotificationBellInner /></SafeBoundary>
);

/** Inner user status that assumes AuthProvider is present. */
const UserStatusInner: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <span className="statusbar__user" title={user.username}>
      <UserIcon size={12} />
      {user.displayName}
    </span>
  );
};

/** User status wrapped in an error boundary so it renders nothing when AuthProvider is absent. */
const UserStatus: React.FC = () => (
  <SafeBoundary><UserStatusInner /></SafeBoundary>
);

type HealthStatus = "ok" | "degraded" | "unhealthy" | "disconnected" | "checking";

const STATUS_LABELS: Record<HealthStatus, string> = {
  ok: "정상",
  degraded: "일부 서비스 미연결",
  unhealthy: "비정상",
  disconnected: "연결 끊김",
  checking: "확인 중",
};

export const StatusBar: React.FC = () => {
  const toast = useToast();
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [detail, setDetail] = useState<{ version: string; uptime: number } | null>(null);
  const prevStatus = useRef<HealthStatus>("checking");

  useEffect(() => {
    const check = async () => {
      try {
        const data = await healthCheck();
        const s = data?.status as string;
        if (data?.detail) setDetail(data.detail as { version: string; uptime: number });

        if (s === "ok" || s === "degraded" || s === "unhealthy") {
          const newStatus = s as HealthStatus;
          setStatus(newStatus);

          // Toast on transition to degraded/unhealthy
          if (newStatus === "unhealthy" && prevStatus.current !== "unhealthy") {
            toast.error("백엔드 서비스가 비정상 상태입니다.");
          } else if (newStatus === "degraded" && prevStatus.current === "ok") {
            toast.warning("일부 서비스가 미연결 상태입니다.");
          }

          prevStatus.current = newStatus;
        } else {
          if (prevStatus.current !== "disconnected") {
            toast.error("백엔드 연결이 끊어졌습니다.");
          }
          setStatus("disconnected");
          prevStatus.current = "disconnected";
        }
      } catch {
        if (prevStatus.current !== "disconnected") {
          toast.error("백엔드 연결이 끊어졌습니다.");
        }
        setStatus("disconnected");
        prevStatus.current = "disconnected";
      }
    };

    check();
    const interval = setInterval(check, POLL_HEALTH_MS);
    return () => clearInterval(interval);
  }, [toast]);

  const dotClass = (() => {
    switch (status) {
      case "ok": return "ok";
      case "degraded": return "warning";
      case "unhealthy":
      case "disconnected": return "error";
      case "checking": return "checking";
    }
  })();

  return (
    <div className="statusbar">
      <div className="statusbar-item">
        <span>AEGIS {detail ? `v${detail.version}` : `v${__APP_VERSION__}`}</span>
      </div>
      <div className="statusbar-item" style={{ gap: "var(--space-3)" }}>
        <NotificationBell />
        <UserStatus />
        <div className="statusbar-item" role="status" aria-live="polite" title={STATUS_LABELS[status]}>
          <span className={`status-dot ${dotClass}`} aria-hidden="true" />
          <span>{STATUS_LABELS[status]}</span>
        </div>
      </div>
    </div>
  );
};
