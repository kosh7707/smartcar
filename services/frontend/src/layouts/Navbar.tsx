import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, Bell, Settings, Sun, Moon, Monitor } from "lucide-react";
import type { Notification } from "@aegis/shared";
import { useNotifications } from "../contexts/NotificationContext";
import {
  getThemePreference,
  isThemePreferenceEnabled,
  setThemePreference,
  type ThemePreference,
} from "../utils/theme";
import "./Navbar.css";

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
  { value: "light", icon: <Sun size={16} />, label: "라이트" },
  { value: "dark", icon: <Moon size={16} />, label: "다크" },
  { value: "system", icon: <Monitor size={16} />, label: "시스템" },
];

function getNotificationToneClass(notification: Notification): string {
  if (notification.type.endsWith("_failed") || notification.severity === "critical") {
    return "navbar-notification--error";
  }
  if (notification.type === "critical_finding" || notification.severity === "medium" || notification.severity === "high") {
    return "navbar-notification--warning";
  }
  return "navbar-notification--success";
}

export const Navbar: React.FC = () => {
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";
  const isProjectRoute = location.pathname.startsWith("/projects/");
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
  const [activeMenu, setActiveMenu] = useState<"notifications" | "theme" | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const recentNotifications = useMemo(() => notifications.slice(0, 6), [notifications]);
  const themeLabel = useMemo(
    () => THEME_OPTIONS.find((option) => option.value === theme)?.label ?? "라이트",
    [theme],
  );

  useEffect(() => {
    setActiveMenu(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!activeMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideNotifications = notificationsRef.current?.contains(target);
      const insideTheme = themeRef.current?.contains(target);
      if (!insideNotifications && !insideTheme) {
        setActiveMenu(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeMenu]);

  const notificationsOpen = activeMenu === "notifications";
  const themeOpen = activeMenu === "theme";

  const handleThemeSelect = (preference: ThemePreference) => {
    if (!isThemePreferenceEnabled(preference)) {
      return;
    }
    setThemePreference(preference);
    setTheme(preference);
    setActiveMenu(null);
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <Link to="/dashboard" className="navbar-brand" aria-label="AEGIS 홈">
          <span className="navbar-brand__icon">
            <Shield size={18} />
          </span>
          <span className="navbar-brand__copy">
            <span className="navbar-brand__title">AEGIS</span>
            <span className="navbar-brand__subtitle">펌웨어 보안 관제 콘솔</span>
          </span>
        </Link>
        <Link
          to="/dashboard"
          className={`navbar-navlink${isDashboard ? " navbar-navlink--active" : ""}`}
          aria-current={isDashboard ? "page" : undefined}
        >
          대시보드
        </Link>
      </div>

      <div className="navbar-actions">
        <Link to="/settings" className="navbar-actions__link">
          <Settings size={16} />
          <span>설정</span>
        </Link>
        <div className="navbar-theme" ref={themeRef}>
          <button
            className={`navbar-actions__btn${themeOpen ? " navbar-actions__btn--active" : ""}`}
            title={`테마 (현재: ${themeLabel})`}
            aria-label={`테마 설정 (현재: ${themeLabel})`}
            aria-expanded={themeOpen}
            aria-haspopup="dialog"
            onClick={() => setActiveMenu((prev) => (prev === "theme" ? null : "theme"))}
          >
            <Sun size={16} />
          </button>

          {themeOpen && (
            <div className="navbar-theme__dropdown" role="dialog" aria-label="테마 설정">
              <div className="navbar-theme__header">
                <div className="navbar-theme__title">테마</div>
                <div className="navbar-theme__subtitle">라이트, 다크, 시스템 테마를 전환할 수 있습니다.</div>
              </div>

              <div className="navbar-theme__body">
                {THEME_OPTIONS.map((option) => {
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`navbar-theme__option${theme === option.value ? " navbar-theme__option--active" : ""}`}
                      onClick={() => handleThemeSelect(option.value)}
                    >
                      <span className="navbar-theme__option-icon">{option.icon}</span>
                      <span className="navbar-theme__option-label">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="navbar-notifications" ref={notificationsRef}>
          <button
            className={`navbar-actions__btn${notificationsOpen ? " navbar-actions__btn--active" : ""}`}
            title="알림"
            aria-label={`알림${unreadCount > 0 ? ` (${unreadCount}건 읽지 않음)` : ""}`}
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
            onClick={() => setActiveMenu((prev) => (prev === "notifications" ? null : "notifications"))}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="navbar-actions__badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
            )}
          </button>

          {notificationsOpen && (
            <div className="navbar-notifications__dropdown" role="dialog" aria-label="프로젝트 알림">
              <div className="navbar-notifications__header">
                <div>
                  <div className="navbar-notifications__title">알림</div>
                  <div className="navbar-notifications__subtitle">
                    {isProjectRoute ? "현재 프로젝트 비동기 작업 상태" : "프로젝트 화면에서 알림을 확인할 수 있습니다"}
                  </div>
                </div>
                {unreadCount > 0 && (
                  <button
                    className="navbar-notifications__mark-all"
                    type="button"
                    onClick={() => void markAllRead()}
                  >
                    모두 읽음
                  </button>
                )}
              </div>

              <div className="navbar-notifications__body">
                {loading ? (
                  <div className="navbar-notifications__empty">알림을 불러오는 중...</div>
                ) : recentNotifications.length === 0 ? (
                  <div className="navbar-notifications__empty">
                    {isProjectRoute ? "아직 프로젝트 알림이 없습니다." : "프로젝트 내부에서 생성된 알림이 여기에 표시됩니다."}
                  </div>
                ) : (
                  recentNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`navbar-notification ${getNotificationToneClass(notification)}${notification.read ? "" : " navbar-notification--unread"}`}
                    >
                      <div className="navbar-notification__content">
                        <div className="navbar-notification__title-row">
                          <span className="navbar-notification__title">{notification.title}</span>
                          {!notification.read && <span className="navbar-notification__dot" aria-hidden="true" />}
                        </div>
                        {notification.body && (
                          <div className="navbar-notification__body-text">{notification.body}</div>
                        )}
                        <div className="navbar-notification__meta">
                          {notification.jobKind && <span>{notification.jobKind}</span>}
                          <span>{new Date(notification.createdAt).toLocaleString("ko-KR")}</span>
                        </div>
                      </div>
                      {!notification.read && (
                        <button
                          className="navbar-notification__mark-read"
                          type="button"
                          onClick={() => void markRead(notification.id)}
                        >
                          읽음
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <span className="navbar-actions__divider" />
        <div className="navbar-actions__avatar" title="Kosh (관리자)">K</div>
      </div>
    </header>
  );
};
