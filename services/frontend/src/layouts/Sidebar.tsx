import React, { useState, useCallback, useEffect } from "react";
import { NavLink, useMatch, useNavigate } from "react-router-dom";
import {
  FolderOpen,
  Settings,
  ChevronLeft,
  LayoutDashboard,
  FileSearch,
  Shield,
  ShieldCheck,
  ClipboardCheck,
  Files,
  Clock,
  FileText,
  Activity,
  Zap,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Sidebar as ShellSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "../components/ui/sidebar";
import { useProjects } from "../contexts/ProjectContext";
import { useAnalysisGuard } from "../contexts/AnalysisGuardContext";
import { cn } from "../lib/utils";
import { ConfirmDialog } from "../shared/ui";
import { fetchApprovalCount } from "../api/approval";

const ICON_SIZE = 18;

const projectNavItems = [
  { sub: "overview", label: "개요", icon: LayoutDashboard, comingSoon: false },
  { sub: "files", label: "파일 탐색기", icon: Files, comingSoon: false },
  { sub: "vulnerabilities", label: "취약점 목록", icon: Shield, comingSoon: false },
  { sub: "static-analysis", label: "정적 분석", icon: FileSearch, comingSoon: false },
  { sub: "dynamic-analysis", label: "동적 분석", icon: Activity, comingSoon: false },
  { sub: "dynamic-test", label: "동적 테스트", icon: Zap, comingSoon: false },
  { sub: "quality-gate", label: "품질 게이트", icon: ShieldCheck, comingSoon: false },
  { sub: "approvals", label: "승인 큐", icon: ClipboardCheck, comingSoon: false },
  { sub: "analysis-history", label: "분석 이력", icon: Clock, comingSoon: false },
  { sub: "report", label: "보고서", icon: FileText, comingSoon: false },
  { sub: "settings", label: "설정", icon: Settings, comingSoon: false },
];

const sidebarLinkClassName = cn(
  "relative h-9 gap-3 rounded-lg px-3 text-[var(--aegis-sidebar-text)] hover:bg-[var(--aegis-sidebar-hover)] hover:text-[var(--aegis-sidebar-text-active)] [&_svg]:opacity-75 aria-[current=page]:bg-[linear-gradient(90deg,rgba(15,98,254,0.18),rgba(255,255,255,0.03))] aria-[current=page]:font-medium aria-[current=page]:text-[var(--aegis-sidebar-text-active)] aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-1.5 aria-[current=page]:before:left-0 aria-[current=page]:before:w-[3px] aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-[var(--cds-interactive)] aria-[current=page]:before:shadow-[var(--aegis-glow-interactive)] aria-[current=page]:[&_svg]:opacity-100",
);

interface SidebarNavItem {
  sub: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const Sidebar: React.FC = () => {
  const projectMatch = useMatch("/projects/:projectId/*");
  const projectId = projectMatch?.params.projectId;
  const { getProject } = useProjects();
  const project = projectId ? getProject(projectId) : null;
  const navigate = useNavigate();
  const { isBlocking } = useAnalysisGuard();
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    fetchApprovalCount(projectId)
      .then((data) => setPendingApprovals(data.pending))
      .catch(() => setPendingApprovals(0));
  }, [projectId]);

  const handleNavClick = useCallback((e: React.MouseEvent, to: string) => {
    if (isBlocking) {
      e.preventDefault();
      setPendingNav(to);
    }
  }, [isBlocking]);

  const confirmNav = useCallback(() => {
    if (pendingNav) {
      navigate(pendingNav);
      setPendingNav(null);
    }
  }, [pendingNav, navigate]);

  const renderNavItem = useCallback(
    (item: SidebarNavItem, to: string, extra?: React.ReactNode) => (
      <SidebarMenuItem key={item.sub}>
        <SidebarMenuButton asChild className={sidebarLinkClassName}>
          <NavLink to={to} onClick={(event) => handleNavClick(event, to)}>
            <item.icon size={ICON_SIZE} />
            <span>{item.label}</span>
          </NavLink>
        </SidebarMenuButton>
        {extra}
      </SidebarMenuItem>
    ),
    [handleNavClick],
  );

  return (
    <>
      <SidebarProvider
        className="min-h-0 w-auto flex-none"
        style={{ "--sidebar-width": "var(--aegis-sidebar-width)" } as React.CSSProperties}
      >
        <ShellSidebar
          collapsible="none"
          className="border-r border-[var(--aegis-sidebar-border)] bg-[linear-gradient(180deg,#101317,var(--aegis-sidebar-bg)_22%,#121619_100%)] text-[var(--aegis-sidebar-text)]"
        >
          <SidebarHeader className="gap-0 px-4 pt-5 pb-4">
            {projectId ? (
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start rounded-lg px-3 py-2 text-left text-[var(--aegis-sidebar-text)] hover:bg-white/5 hover:text-[var(--aegis-sidebar-text-active)]"
                onClick={() => {
                  if (isBlocking) {
                    setPendingNav("/projects");
                    return;
                  }
                  navigate("/projects");
                }}
              >
                <ChevronLeft size={20} className="shrink-0" />
                <span className="flex min-w-0 flex-col text-left">
                  <span className="truncate text-sm font-semibold text-[var(--aegis-sidebar-text-active)]">
                    {project?.name ?? "알 수 없는 프로젝트"}
                  </span>
                  <span className="text-xs tracking-[0.02em] text-white/60">프로젝트 작업 공간</span>
                </span>
              </Button>
            ) : (
              <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                <Shield size={20} className="shrink-0 text-[var(--aegis-sidebar-text)]" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-[var(--aegis-sidebar-text-active)]">AEGIS</span>
                  <span className="text-xs tracking-[0.02em] text-white/60">보안 분석 워크스페이스</span>
                </div>
              </div>
            )}
          </SidebarHeader>

          <SidebarSeparator className="bg-[var(--aegis-sidebar-border)]" />

          <SidebarContent className="px-2 pb-3">
            <ScrollArea className="h-full">
              <SidebarGroup className="p-0">
                <SidebarMenu className="gap-1 px-1">
                  {projectId
                    ? projectNavItems.map((item) =>
                        renderNavItem(
                          item,
                          `/projects/${projectId}/${item.sub}`,
                          item.sub === "approvals" && pendingApprovals > 0 ? (
                            <SidebarMenuBadge className="top-2 rounded-full bg-[var(--cds-interactive)] px-1.5 text-white shadow-[var(--aegis-glow-interactive)]">
                              {pendingApprovals}
                            </SidebarMenuBadge>
                          ) : undefined,
                        ),
                      )
                    : [
                        renderNavItem({ sub: "dashboard", label: "프로젝트", icon: FolderOpen }, "/dashboard"),
                        renderNavItem({ sub: "settings", label: "설정", icon: Settings }, "/settings"),
                      ]}
                </SidebarMenu>
              </SidebarGroup>
            </ScrollArea>
          </SidebarContent>
        </ShellSidebar>
      </SidebarProvider>

      <ConfirmDialog
        open={!!pendingNav}
        title="분석 진행 중"
        message="분석이 진행 중입니다. 이동하시겠습니까? (분석은 백그라운드에서 계속됩니다)"
        confirmLabel="이동"
        onConfirm={confirmNav}
        onCancel={() => setPendingNav(null)}
      />
    </>
  );
};
