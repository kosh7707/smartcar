import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, ChevronDown, Moon, Search, Settings, Sun } from "lucide-react";
import type { Notification } from "@aegis/shared";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useNotifications } from "../contexts/NotificationContext";
import { getThemePreference, setThemePreference, type ThemePreference } from "../utils/theme";

function getNotificationToneClass(notification: Notification): string {
  if (notification.type.endsWith("_failed") || notification.severity === "critical") return "sev-chip critical";
  if (notification.type === "critical_finding" || notification.severity === "medium" || notification.severity === "high") return "sev-chip high";
  return "sev-chip low";
}

export const Navbar: React.FC = () => {
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";
  const isProjectRoute = location.pathname.startsWith("/projects/");
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const recentNotifications = useMemo(() => notifications.slice(0, 6), [notifications]);
  const themeLabel = theme === "dark" ? "다크" : theme === "light" ? "라이트" : "시스템";

  useEffect(() => {
    setNotificationsOpen(false);
    setThemeOpen(false);
  }, [location.pathname]);

  const handleThemeSelect = (preference: ThemePreference) => {
    setThemePreference(preference);
    setTheme(preference);
    setThemeOpen(false);
  };

  return (
    <nav className="nav" style={{ position: "relative" }}>
      <Link className="nav-brand" to="/dashboard" aria-label="AEGIS 홈">
        <span className="shield" aria-hidden="true"><svg viewBox="0 0 44 48" fill="none"><path d="M22 1 L42 6 V24 C42 36 33 44 22 47 C11 44 2 36 2 24 V6 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/><path d="M22 11 L30 15.5 V24.5 L22 29 L14 24.5 V15.5 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.5"/></svg></span>
        <span className="wordmark">AEGIS</span>
        <span className="env"><span className="dot"></span>PROD · kr-seoul-1</span>
      </Link>

      <button type="button" className="nav-search" aria-label="명령 검색 (mock)">
        <Search aria-hidden="true" />
        <span className="ph">프로젝트, 파일, finding 검색…</span>
        <span className="kbd">⌘K</span>
      </button>

      <div className="nav-right">
        <Button asChild variant="ghost" size="sm"><Link to="/dashboard" aria-current={isDashboard ? "page" : undefined}>대시보드</Link></Button>

        <Button asChild variant="ghost" size="icon-sm" className="nav-icon" aria-label="설정">
          <Link to="/settings"><Settings /><span className="sr-only">설정</span></Link>
        </Button>

        <Button variant="ghost" size="icon-sm" className="nav-icon" aria-label={`테마 설정 (현재: ${themeLabel})`} title={`테마 설정 (현재: ${themeLabel})`} onClick={() => setThemeOpen((v) => !v)}>
          <Sun className="sun" />
          <Moon className="moon" />
        </Button>

        <Button variant="ghost" size="icon-sm" className="nav-icon" aria-label={`알림${unreadCount > 0 ? ` (${unreadCount}건 읽지 않음)` : ""}`} title="알림" onClick={() => setNotificationsOpen((v) => !v)}>
          <Bell />
          {unreadCount > 0 ? <span className="badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
        </Button>

        <button className="nav-user" aria-label="계정 · 김코세화" title="김코세화 · LEAD · SECOPS">
          <span className="avatar" aria-hidden="true">김</span>
          <span className="u-text"><span className="name">김코세화</span><span className="role">LEAD · SECOPS</span></span>
          <ChevronDown />
        </button>
      </div>

      {themeOpen ? (
        <div className="nav-dropdown" style={{ position: "absolute", top: "calc(100% + 8px)", right: "96px" }}>
          <div className="nav-dropdown-head">
            <div>
              <div className="nav-dropdown-title">테마</div>
              <div className="nav-dropdown-copy">라이트, 다크, 시스템을 전환합니다.</div>
            </div>
          </div>
          <div className="nav-dropdown-body" style={{ padding: "var(--space-3)" }}>
            {(["light", "dark", "system"] as ThemePreference[]).map((pref) => (
              <button key={pref} type="button" className="btn btn-ghost btn-block" style={{ justifyContent: "space-between", marginBottom: 4 }} onClick={() => handleThemeSelect(pref)}>
                <span>{pref === "light" ? "라이트" : pref === "dark" ? "다크" : "시스템"}</span>
                {theme === pref ? <Badge variant="outline">현재</Badge> : null}
              </button>
            ))}
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
            {unreadCount > 0 ? <Button variant="link" size="sm" onClick={() => void markAllRead()}>모두 읽음</Button> : null}
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
                {!notification.read ? <Button variant="outline" size="xs" onClick={() => void markRead(notification.id)}>읽음</Button> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
};
