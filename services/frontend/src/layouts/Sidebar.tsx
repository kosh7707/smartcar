import React, { useCallback, useEffect, useState } from "react";
import { NavLink, useMatch, useNavigate } from "react-router-dom";
import {
  Activity,
  ChevronLeft,
  ClipboardCheck,
  Clock,
  FileSearch,
  FileText,
  Files,
  FolderOpen,
  LayoutDashboard,
  Settings,
  Shield,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useProjects } from "../contexts/ProjectContext";
import { useAnalysisGuard } from "../contexts/AnalysisGuardContext";
import { ConfirmDialog } from "../shared/ui";
import { fetchApprovalCount } from "../api/approval";

type IconComponent = React.ComponentType<{ className?: string }>;

interface NavItem {
  sub: string;
  label: string;
  icon: IconComponent;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const projectNavGroups: NavGroup[] = [
  {
    items: [
      { sub: "overview", label: "개요", icon: LayoutDashboard },
    ],
  },
  {
    label: "분석",
    items: [
      { sub: "files", label: "파일 탐색기", icon: Files },
      { sub: "vulnerabilities", label: "취약점 목록", icon: Shield },
      { sub: "static-analysis", label: "정적 분석", icon: FileSearch },
      { sub: "dynamic-analysis", label: "동적 분석", icon: Activity },
      { sub: "dynamic-test", label: "동적 테스트", icon: Zap },
    ],
  },
  {
    label: "검증",
    items: [
      { sub: "quality-gate", label: "품질 게이트", icon: ShieldCheck },
      { sub: "approvals", label: "승인 큐", icon: ClipboardCheck },
    ],
  },
  {
    label: "기록",
    items: [
      { sub: "analysis-history", label: "분석 이력", icon: Clock },
      { sub: "report", label: "보고서", icon: FileText },
    ],
  },
];

const projectFooterItem: NavItem = { sub: "settings", label: "설정", icon: Settings };

// NOTE: The project-scoped sidebar is an S1 shell pattern for deep project routes.
// It is intentionally outside the external dashboard mock surface and keeps dense
// navigation local to project workspaces.
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

  const guardedNavigate = useCallback((to: string) => {
    if (isBlocking) {
      setPendingNav(to);
      return;
    }
    navigate(to);
  }, [isBlocking, navigate]);

  const renderProjectLink = (item: NavItem) => {
    if (!projectId) return null;
    const to = `/projects/${projectId}/${item.sub}`;
    return (
      <NavLink
        key={item.sub}
        className="app-sidebar-link"
        to={to}
        onClick={(event) => {
          if (isBlocking) {
            event.preventDefault();
            setPendingNav(to);
          }
        }}
      >
        <item.icon />
        <span>{item.label}</span>
        {item.sub === "approvals" && pendingApprovals > 0 ? (
          <span className="app-sidebar-badge" aria-label={`승인 대기 ${pendingApprovals}건`}>
            {pendingApprovals > 99 ? "99+" : pendingApprovals}
          </span>
        ) : null}
      </NavLink>
    );
  };

  return (
    <>
      <aside className="app-sidebar">
        <div className="app-sidebar-head">
          {projectId ? (
            <>
              <button
                type="button"
                className="app-sidebar-back"
                onClick={() => guardedNavigate("/dashboard")}
                title="대시보드로"
              >
                <ChevronLeft aria-hidden="true" />
                <span>프로젝트 허브</span>
              </button>
              <div className="app-sidebar-project" title={project?.name ?? "알 수 없는 프로젝트"}>
                <div className="app-sidebar-project-name">
                  {project?.name ?? "알 수 없는 프로젝트"}
                </div>
                <div className="app-sidebar-project-meta">
                  <span className="app-sidebar-project-dot" aria-hidden="true" />
                  <span>프로젝트 작업 공간</span>
                </div>
              </div>
            </>
          ) : (
            <div className="app-sidebar-title">
              <FolderOpen />
              <span>
                <span className="app-sidebar-title-main">AEGIS</span>
                <span className="app-sidebar-title-sub">보안 분석 워크스페이스</span>
              </span>
            </div>
          )}
        </div>

        <div className="app-sidebar-body scroll">
          <nav className="app-sidebar-nav" aria-label="프로젝트 탐색">
            {projectId ? projectNavGroups.map((group, index) => (
              <div key={group.label ?? `group-${index}`} className="app-sidebar-group">
                {group.label ? (
                  <div className="app-sidebar-group-label">{group.label}</div>
                ) : null}
                {group.items.map(renderProjectLink)}
              </div>
            )) : (
              <>
                <NavLink className="app-sidebar-link" to="/dashboard"><FolderOpen /><span>프로젝트</span></NavLink>
                <NavLink className="app-sidebar-link" to="/settings"><Settings /><span>설정</span></NavLink>
              </>
            )}
          </nav>
        </div>

        {projectId ? (
          <div className="app-sidebar-foot">
            {renderProjectLink(projectFooterItem)}
          </div>
        ) : null}
      </aside>

      <ConfirmDialog
        open={!!pendingNav}
        title="분석 진행 중"
        message="분석이 진행 중입니다. 이동하시겠습니까? (분석은 백그라운드에서 계속됩니다)"
        confirmLabel="이동"
        onConfirm={() => {
          if (pendingNav) navigate(pendingNav);
          setPendingNav(null);
        }}
        onCancel={() => setPendingNav(null)}
      />
    </>
  );
};
