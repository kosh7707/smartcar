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

/** Module-level health cache to prevent redundant checks on remount. */
let _cachedStatus: HealthStatus = "checking";
let _cachedDetail: { version: string; uptime: number } | null = null;
let _lastCheckAt = 0;
let _intervalId: ReturnType<typeof setInterval> | null = null;
let _mountCount = 0;

/** Reset cache — test only. */
export function _resetHealthCache() {
  _cachedStatus = "checking";
  _cachedDetail = null;
  _lastCheckAt = 0;
  if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
  _mountCount = 0;
}

export const StatusBar: React.FC = () => {
  const toast = useToast();
  const [status, setStatus] = useState<HealthStatus>(_cachedStatus);
  const [detail, setDetail] = useState<{ version: string; uptime: number } | null>(_cachedDetail);
  const prevStatus = useRef<HealthStatus>(_cachedStatus);

  useEffect(() => {
    _mountCount++;

    const check = async () => {
      try {
        const data = await healthCheck();
        const s = data?.status as string;
        if (data?.detail) {
          _cachedDetail = data.detail as { version: string; uptime: number };
          setDetail(_cachedDetail);
        }

        if (s === "ok" || s === "degraded" || s === "unhealthy") {
          const newStatus = s as HealthStatus;
          _cachedStatus = newStatus;
          setStatus(newStatus);

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
          _cachedStatus = "disconnected";
          setStatus("disconnected");
          prevStatus.current = "disconnected";
        }
      } catch {
        if (prevStatus.current !== "disconnected") {
          toast.error("백엔드 연결이 끊어졌습니다.");
        }
        _cachedStatus = "disconnected";
        setStatus("disconnected");
        prevStatus.current = "disconnected";
      }
      _lastCheckAt = Date.now();
    };

    // Skip immediate check if cached result is fresh (within poll interval)
    const elapsed = Date.now() - _lastCheckAt;
    if (elapsed >= POLL_HEALTH_MS || _cachedStatus === "checking") {
      check();
    }

    // Share a single global interval — only the first mount creates it
    if (!_intervalId) {
      _intervalId = setInterval(check, POLL_HEALTH_MS);
    }

    return () => {
      _mountCount--;
      if (_mountCount <= 0 && _intervalId) {
        clearInterval(_intervalId);
        _intervalId = null;
        _mountCount = 0;
      }
    };
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
      <div className="statusbar-item statusbar__left">
        <div className="statusbar-item" role="status" aria-live="polite" title={STATUS_LABELS[status]}>
          <span className={`status-dot ${dotClass}`} aria-hidden="true" />
          <span>{STATUS_LABELS[status]}</span>
        </div>
      </div>
      <div className="statusbar__center">
        AEGIS v2.1.0 — Embedded Firmware Security Analysis Platform
      </div>
      <div className="statusbar-item statusbar__right">
        <NotificationBell />
        <UserStatus />
      </div>
    </div>
  );
};
