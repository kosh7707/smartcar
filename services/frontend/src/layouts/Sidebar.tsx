import React, { useCallback, useEffect, useState } from "react";
import { NavLink, useMatch, useNavigate } from "react-router-dom";
import { ChevronLeft, LayoutDashboard, Files, Shield, FileSearch, Activity, Zap, ShieldCheck, ClipboardCheck, Clock, FileText, Settings, FolderOpen } from "lucide-react";
import { useProjects } from "../contexts/ProjectContext";
import { useAnalysisGuard } from "../contexts/AnalysisGuardContext";
import { ConfirmDialog } from "../shared/ui";
import { fetchApprovalCount } from "../api/approval";

const projectNavItems = [
  { sub: "overview", label: "개요", icon: LayoutDashboard },
  { sub: "files", label: "파일 탐색기", icon: Files },
  { sub: "vulnerabilities", label: "취약점 목록", icon: Shield },
  { sub: "static-analysis", label: "정적 분석", icon: FileSearch },
  { sub: "dynamic-analysis", label: "동적 분석", icon: Activity },
  { sub: "dynamic-test", label: "동적 테스트", icon: Zap },
  { sub: "quality-gate", label: "품질 게이트", icon: ShieldCheck },
  { sub: "approvals", label: "승인 큐", icon: ClipboardCheck },
  { sub: "analysis-history", label: "분석 이력", icon: Clock },
  { sub: "report", label: "보고서", icon: FileText },
  { sub: "settings", label: "설정", icon: Settings },
];

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

  return (
    <>
      <aside className="app-sidebar">
        <div className="app-sidebar-head">
          {projectId ? (
            <button type="button" className="app-sidebar-title-btn" onClick={() => guardedNavigate("/projects") }>
              <ChevronLeft />
              <span>
                <span className="app-sidebar-title-main">{project?.name ?? "알 수 없는 프로젝트"}</span>
                <span className="app-sidebar-title-sub">프로젝트 작업 공간</span>
              </span>
            </button>
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
          <nav className="app-sidebar-nav">
            {projectId ? projectNavItems.map((item) => (
              <NavLink key={item.sub} className="app-sidebar-link" to={`/projects/${projectId}/${item.sub}`} onClick={(event) => {
                if (isBlocking) {
                  event.preventDefault();
                  setPendingNav(`/projects/${projectId}/${item.sub}`);
                }
              }}>
                <item.icon />
                <span>{item.label}</span>
                {item.sub === "approvals" && pendingApprovals > 0 ? <span className="app-sidebar-badge">{pendingApprovals}</span> : null}
              </NavLink>
            )) : (
              <>
                <NavLink className="app-sidebar-link" to="/dashboard"><FolderOpen /><span>프로젝트</span></NavLink>
                <NavLink className="app-sidebar-link" to="/settings"><Settings /><span>설정</span></NavLink>
              </>
            )}
          </nav>
        </div>
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
