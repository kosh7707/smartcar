import React from "react";
import { NavLink, useMatch, useNavigate } from "react-router-dom";
import {
  FolderOpen,
  Settings,
  ChevronLeft,
  LayoutDashboard,
  FileSearch,
  Activity,
  FlaskConical,
  Shield,
  Files,
  Clock,
} from "lucide-react";
import { useProjects } from "../contexts/ProjectContext";
import "./Sidebar.css";

const ICON_SIZE = 18;

const projectNavItems = [
  { sub: "overview", label: "Overview", icon: LayoutDashboard },
  { sub: "files", label: "파일 탐색기", icon: Files },
  { sub: "vulnerabilities", label: "취약점 목록", icon: Shield },
  { sub: "static-analysis", label: "정적 분석", icon: FileSearch },
  { sub: "dynamic-analysis", label: "동적 분석", icon: Activity },
  { sub: "dynamic-test", label: "동적 테스트", icon: FlaskConical },
  { sub: "analysis-history", label: "분석 이력", icon: Clock },
];

export const Sidebar: React.FC = () => {
  const projectMatch = useMatch("/projects/:projectId/*");
  const projectId = projectMatch?.params.projectId;
  const { getProject } = useProjects();
  const project = projectId ? getProject(projectId) : null;
  const navigate = useNavigate();

  return (
    <nav className="sidebar">
      {projectId ? (
        <>
          <div
            className="sidebar-header sidebar-header-clickable"
            onClick={() => navigate("/projects")}
          >
            <div className="sidebar-header-row">
              <ChevronLeft size={20} className="sidebar-header-icon" />
              <div className="sidebar-header-text">
                <span className="sidebar-title">{project?.name ?? "알 수 없는 프로젝트"}</span>
                <span className="sidebar-subtitle">Security Framework</span>
              </div>
            </div>
          </div>

          <ul className="sidebar-nav">
            {projectNavItems.map((item) => (
              <li key={item.sub}>
                <NavLink
                  to={`/projects/${projectId}/${item.sub}`}
                  className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                >
                  <item.icon size={ICON_SIZE} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="sidebar-divider" />
          <ul className="sidebar-nav sidebar-nav-bottom">
            <li>
              <NavLink
                to={`/projects/${projectId}/settings`}
                className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              >
                <Settings size={ICON_SIZE} />
                설정
              </NavLink>
            </li>
          </ul>
        </>
      ) : (
        <>
          <div className="sidebar-header">
            <div className="sidebar-header-row">
              <Shield size={20} className="sidebar-header-icon" />
              <div className="sidebar-header-text">
                <span className="sidebar-title">Smartcar</span>
                <span className="sidebar-subtitle">Security Framework</span>
              </div>
            </div>
          </div>

          <ul className="sidebar-nav">
            <li>
              <NavLink
                to="/projects"
                end
                className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              >
                <FolderOpen size={ICON_SIZE} />
                프로젝트
              </NavLink>
            </li>
          </ul>

          <div className="sidebar-divider" />
          <ul className="sidebar-nav sidebar-nav-bottom">
            <li>
              <NavLink
                to="/settings"
                className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              >
                <Settings size={ICON_SIZE} />
                설정
              </NavLink>
            </li>
          </ul>
        </>
      )}
    </nav>
  );
};
