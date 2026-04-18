import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, Bell, Settings, Sun, Moon, Monitor } from "lucide-react";
import type { Notification } from "@aegis/shared";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { useNotifications } from "../contexts/NotificationContext";
import { cn } from "../lib/utils";
import {
  getThemePreference,
  isThemePreferenceEnabled,
  setThemePreference,
  type ThemePreference,
} from "../utils/theme";

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
  { value: "light", icon: <Sun size={16} />, label: "라이트" },
  { value: "dark", icon: <Moon size={16} />, label: "다크" },
  { value: "system", icon: <Monitor size={16} />, label: "시스템" },
];

function getNotificationToneClass(notification: Notification): string {
  if (notification.type.endsWith("_failed") || notification.severity === "critical") {
    return "border-l-[var(--cds-support-error)]";
  }
  if (notification.type === "critical_finding" || notification.severity === "medium" || notification.severity === "high") {
    return "border-l-[var(--aegis-severity-medium)]";
  }
  return "border-l-[var(--cds-support-success)]";
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
  const themeLabel = useMemo(
    () => THEME_OPTIONS.find((option) => option.value === theme)?.label ?? "라이트",
    [theme],
  );

  useEffect(() => {
    setNotificationsOpen(false);
    setThemeOpen(false);
  }, [location.pathname]);

  const handleThemeSelect = (preference: ThemePreference) => {
    if (!isThemePreferenceEnabled(preference)) {
      return;
    }
    setThemePreference(preference);
    setTheme(preference);
    setThemeOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 flex min-h-[60px] shrink-0 items-center justify-between border-b border-[var(--cds-border-subtle)] bg-[var(--cds-layer-raised)] px-6 max-[720px]:px-4">
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 py-1.5 text-[var(--cds-text-primary)] no-underline transition-colors hover:bg-[var(--cds-layer-01)]"
          aria-label="AEGIS 홈"
        >
          <span className="flex size-7 items-center justify-center text-[var(--cds-text-primary)]">
            <Shield size={18} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold tracking-[-0.02em] text-[var(--cds-text-primary)]">AEGIS</span>
            <span className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-[var(--cds-text-placeholder)] max-[720px]:hidden">
              펌웨어 보안 관제 콘솔
            </span>
          </span>
        </Link>

        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            "rounded-lg px-3 text-sm font-semibold text-[var(--cds-text-secondary)] hover:bg-[var(--cds-layer-01)] hover:text-[var(--cds-text-primary)]",
            isDashboard && "bg-[var(--cds-layer-01)] text-[var(--cds-text-primary)]",
          )}
        >
          <Link to="/dashboard" aria-current={isDashboard ? "page" : undefined}>
            대시보드
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="rounded-lg px-3 text-[var(--cds-text-secondary)] hover:bg-[var(--cds-layer-01)] hover:text-[var(--cds-text-primary)]"
        >
          <Link to="/settings">
            <Settings size={16} />
            <span className="max-[720px]:hidden">설정</span>
          </Link>
        </Button>

        <DropdownMenu open={themeOpen} onOpenChange={setThemeOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              title={`테마 (현재: ${themeLabel})`}
              aria-label={`테마 설정 (현재: ${themeLabel})`}
              className="rounded-lg text-[var(--cds-text-secondary)] hover:bg-[var(--cds-layer-01)] hover:text-[var(--cds-text-primary)] data-[state=open]:bg-[var(--cds-layer-01)] data-[state=open]:text-[var(--cds-text-primary)]"
              onClick={() => setThemeOpen((prev) => !prev)}
            >
              <Sun size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-60 rounded-xl border border-[var(--cds-border-subtle)] bg-[var(--cds-background)] p-0 shadow-[var(--cds-shadow-dropdown)]"
          >
            <div className="border-b border-[var(--cds-border-subtle)] px-4 py-4">
              <div className="text-sm font-semibold text-[var(--cds-text-primary)]">테마</div>
              <div className="mt-0.5 text-sm text-[var(--cds-text-secondary)]">
                라이트, 다크, 시스템 테마를 전환할 수 있습니다.
              </div>
            </div>

            <div className="flex flex-col gap-1 p-2">
              {THEME_OPTIONS.map((option) => {
                const isActive = theme === option.value;

                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-auto w-full justify-start gap-3 rounded-lg px-3 py-3 text-sm font-medium text-[var(--cds-text-secondary)] hover:bg-[var(--cds-layer-01)] hover:text-[var(--cds-text-primary)]",
                      isActive && "bg-[var(--cds-interactive-subtle)] text-[var(--cds-interactive)] hover:bg-[var(--cds-interactive-subtle)] hover:text-[var(--cds-interactive)]",
                    )}
                    onClick={() => handleThemeSelect(option.value)}
                  >
                    <span className="flex items-center">{option.icon}</span>
                    <span className="flex-1 text-left">{option.label}</span>
                  </Button>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              title="알림"
              aria-label={`알림${unreadCount > 0 ? ` (${unreadCount}건 읽지 않음)` : ""}`}
              className="relative rounded-lg text-[var(--cds-text-secondary)] hover:bg-[var(--cds-layer-01)] hover:text-[var(--cds-text-primary)] data-[state=open]:bg-[var(--cds-layer-01)] data-[state=open]:text-[var(--cds-text-primary)]"
              onClick={() => setNotificationsOpen((prev) => !prev)}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[min(24rem,calc(100vw-2rem))] min-w-80 rounded-xl border border-[var(--cds-border-subtle)] bg-[var(--cds-background)] p-0 shadow-[var(--cds-shadow-dropdown)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--cds-border-subtle)] px-4 py-4">
              <div>
                <div className="text-sm font-semibold text-[var(--cds-text-primary)]">알림</div>
                <div className="mt-0.5 text-sm text-[var(--cds-text-secondary)]">
                  {isProjectRoute ? "현재 프로젝트 비동기 작업 상태" : "프로젝트 화면에서 알림을 확인할 수 있습니다"}
                </div>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-sm text-[var(--cds-interactive)] hover:text-[var(--cds-text-primary)]"
                  type="button"
                  onClick={() => void markAllRead()}
                >
                  모두 읽음
                </Button>
              )}
            </div>

            <ScrollArea className="max-h-[70vh]">
              <div className="flex flex-col">
                {loading ? (
                  <div className="px-5 py-5 text-sm text-[var(--cds-text-secondary)]">알림을 불러오는 중...</div>
                ) : recentNotifications.length === 0 ? (
                  <div className="px-5 py-5 text-sm text-[var(--cds-text-secondary)]">
                    {isProjectRoute ? "아직 프로젝트 알림이 없습니다." : "프로젝트 내부에서 생성된 알림이 여기에 표시됩니다."}
                  </div>
                ) : (
                  recentNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "flex items-start gap-3 border-b border-[var(--cds-border-subtle)] border-l-[3px] border-l-transparent px-4 py-4 last:border-b-0",
                        !notification.read && "bg-[var(--cds-layer-01)]",
                        getNotificationToneClass(notification),
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--cds-text-primary)]">{notification.title}</span>
                          {!notification.read && (
                            <span
                              aria-hidden="true"
                              className="size-2 shrink-0 rounded-full bg-[var(--cds-support-error)]"
                            />
                          )}
                        </div>
                        {notification.body && (
                          <div className="mt-1 text-sm text-[var(--cds-text-secondary)] break-words">{notification.body}</div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-sm text-[var(--cds-text-placeholder)]">
                          {notification.jobKind && <span>{notification.jobKind}</span>}
                          <span>{new Date(notification.createdAt).toLocaleString("ko-KR")}</span>
                        </div>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="outline"
                          size="xs"
                          type="button"
                          className="shrink-0 border-[var(--cds-border-subtle)] text-[var(--cds-text-secondary)] hover:border-[var(--cds-interactive-border)] hover:text-[var(--cds-text-primary)]"
                          onClick={() => void markRead(notification.id)}
                        >
                          읽음
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-2 h-5 bg-[var(--cds-border-subtle)]" />

        <div
          className="inline-flex size-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--cds-interactive),color-mix(in_srgb,var(--cds-interactive)_72%,#8ab4ff))] text-sm font-semibold text-[var(--cds-text-inverse)]"
          title="Kosh (관리자)"
        >
          K
        </div>
      </div>
    </header>
  );
};
