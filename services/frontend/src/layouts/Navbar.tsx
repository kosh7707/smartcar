import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Moon, Settings, ShieldCheck, Sun } from "lucide-react";
import type { Notification, User } from "@aegis/shared";
import { cn } from "@/lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { setThemePreference } from "../utils/theme";

const ROLE_LABEL: Record<User["role"], string> = {
  admin: "관리자",
  analyst: "분석가",
  viewer: "열람자",
};

function isDarkApplied(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function firstAvatarChar(name: string): string {
  const trimmed = name.trim();
  return trimmed ? Array.from(trimmed)[0]! : "?";
}

function getNotificationToneClass(notification: Notification): string {
  if (notification.type.endsWith("_failed") || notification.severity === "critical") return "sev-chip critical";
  if (notification.type === "critical_finding" || notification.severity === "medium" || notification.severity === "high") return "sev-chip high";
  return "sev-chip low";
}

export const Navbar: React.FC = () => {
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";
  const isAdminRegistrations = location.pathname.startsWith("/admin/registrations");
  const isProjectRoute = location.pathname.startsWith("/projects/");
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const displayName = user?.displayName || user?.username || "게스트";
  const roleLabel = user ? ROLE_LABEL[user.role] : "";
  const orgCode = user?.organizationCode ?? "";
  const orgName = user?.organizationName ?? "";
  const chipRoleLine = orgCode ? `${roleLabel} · ${orgCode}` : roleLabel;
  const avatarChar = firstAvatarChar(displayName);
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [darkMode, setDarkMode] = useState(() => isDarkApplied());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const recentNotifications = useMemo(() => notifications.slice(0, 6), [notifications]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDarkMode(isDarkApplied()));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setNotificationsOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const toggleTheme = () => {
    const next = isDarkApplied() ? "light" : "dark";
    setThemePreference(next);
    setDarkMode(next === "dark");
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      setUserMenuOpen(false);
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <nav className="nav" style={{ position: "relative" }}>
      <div className="nav-left">
        <Link className="nav-brand" to="/dashboard" aria-label="AEGIS 홈">
          <span className="shield" aria-hidden="true"><svg viewBox="0 0 44 48" fill="none"><path d="M22 1 L42 6 V24 C42 36 33 44 22 47 C11 44 2 36 2 24 V6 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/><path d="M22 11 L30 15.5 V24.5 L22 29 L14 24.5 V15.5 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.5"/></svg></span>
          <span className="wordmark">AEGIS</span>
        </Link>

        <span className="nav-divider" aria-hidden="true" />

        <div className="nav-cluster" role="group" aria-label="주요 탐색">
          <Link to="/dashboard" className="btn btn-ghost btn-sm" aria-current={isDashboard ? "page" : undefined}>
            대시보드
          </Link>

          {isAdmin ? (
            <Link to="/admin/registrations" className="btn btn-ghost btn-sm" aria-current={isAdminRegistrations ? "page" : undefined}>
              <ShieldCheck aria-hidden="true" />
              관리자
            </Link>
          ) : null}
        </div>
      </div>

      <div className="nav-right">
        <div className="nav-cluster" role="group" aria-label="유틸리티">
          <Link to="/settings" className="btn btn-ghost btn-icon-sm nav-icon" aria-label="설정">
            <Settings />
            <span className="sr-only">설정</span>
          </Link>

          <button
            type="button"
            className="btn btn-ghost btn-icon-sm nav-icon"
            aria-label={darkMode ? "현재 다크 모드 · 라이트로 전환" : "현재 라이트 모드 · 다크로 전환"}
            title={darkMode ? "현재 다크 모드 · 라이트로 전환" : "현재 라이트 모드 · 다크로 전환"}
            onClick={toggleTheme}
          >
            {darkMode ? <Sun /> : <Moon />}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-icon-sm nav-icon"
            aria-label={`알림${unreadCount > 0 ? ` (${unreadCount}건 읽지 않음)` : ""}`}
            title="알림"
            onClick={() => setNotificationsOpen((v) => !v)}
          >
            <Bell />
            {unreadCount > 0 ? <span className="badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
          </button>
        </div>

        <span className="nav-divider" aria-hidden="true" />

        <button
          type="button"
          className="btn btn-ghost btn-icon-sm nav-user"
          aria-label={user ? `계정 · ${displayName}` : "계정"}
          title={user ? `${displayName} · ${roleLabel}${orgName ? ` · ${orgName}` : ""}` : "계정"}
          onClick={() => setUserMenuOpen((v) => !v)}
          aria-expanded={userMenuOpen}
        >
          <span className="avatar" aria-hidden="true">{avatarChar}</span>
          <span className="u-text">
            <span className="name">{displayName}</span>
            <span className="role">{chipRoleLine}</span>
          </span>
          <ChevronDown />
        </button>
      </div>

      {userMenuOpen ? (
        <div className="nav-dropdown" style={{ position: "absolute", top: "calc(100% + 8px)", right: "16px", minWidth: 240 }}>
          <div className="nav-dropdown-head">
            <div>
              <div className="nav-dropdown-title">{displayName}</div>
              <div className="nav-dropdown-copy">
                {user?.email ? <span style={{ fontFamily: "var(--font-mono)" }}>{user.email}</span> : null}
                {user?.email ? <span style={{ margin: "0 6px" }}>·</span> : null}
                <span>{roleLabel}</span>
                {orgName ? <><span style={{ margin: "0 6px" }}>·</span><span>{orgName}</span></> : null}
              </div>
            </div>
          </div>
          <div className="nav-dropdown-body" style={{ padding: "var(--space-3)" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-block"
              style={{ justifyContent: "flex-start", width: "100%" }}
              onClick={() => void handleLogout()}
              disabled={loggingOut || !user}
            >
              <LogOut aria-hidden="true" />
              {loggingOut ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </div>
      ) : null}

      {notificationsOpen ? (
        <div className="nav-dropdown" style={{ position: "absolute", top: "calc(100% + 8px)", right: "40px" }}>
          <div className="nav-dropdown-head">
            <div>
              <div className="nav-dropdown-title">알림</div>
              <div className="nav-dropdown-copy">{isProjectRoute ? "현재 프로젝트 비동기 작업 상태" : "프로젝트 화면에서 알림을 확인할 수 있습니다"}</div>
            </div>
            {unreadCount > 0 ? (
              <button type="button" className="btn btn-link btn-sm" onClick={() => void markAllRead()}>
                모두 읽음
              </button>
            ) : null}
          </div>
          <div className="nav-dropdown-body">
            {loading ? (
              <div className="nav-dropdown-item"><div className="nav-dropdown-item-copy">알림을 불러오는 중...</div></div>
            ) : recentNotifications.length === 0 ? (
              <div className="nav-dropdown-item"><div className="nav-dropdown-item-copy">{isProjectRoute ? "아직 프로젝트 알림이 없습니다." : "프로젝트 내부에서 생성된 알림이 여기에 표시됩니다."}</div></div>
            ) : recentNotifications.map((notification) => (
              <div key={notification.id} className={`nav-dropdown-item ${!notification.read ? "is-unread" : ""}`}>
                <div style={{ flex: 1 }}>
                  <div className="inline-stack">
                    <span className="nav-dropdown-item-title">{notification.title}</span>
                    <span className={getNotificationToneClass(notification)}>{notification.jobKind ?? notification.type}</span>
                  </div>
                  {notification.body ? <div className="nav-dropdown-item-copy">{notification.body}</div> : null}
                  <div className="nav-dropdown-item-meta"><span>{new Date(notification.createdAt).toLocaleString("ko-KR")}</span></div>
                </div>
                {!notification.read ? (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void markRead(notification.id)}>
                    읽음
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
};
