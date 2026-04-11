import React from "react";
import { Outlet, useParams, Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useProjects } from "../contexts/ProjectContext";
import "./ProjectBreadcrumbLayout.css";

const pageNames: Record<string, string> = {
  overview: "대시보드",
  "static-analysis": "정적 분석",
  files: "파일 탐색기",
  vulnerabilities: "취약점 목록",
  "analysis-history": "분석 이력",
  report: "보고서",
  settings: "프로젝트 설정",
  "quality-gate": "Quality Gate",
  approvals: "Approval Queue",
  "dynamic-analysis": "동적 분석",
  "dynamic-test": "동적 테스트",
};

export const ProjectBreadcrumbLayout: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { getProject } = useProjects();
  const project = projectId ? getProject(projectId) : null;
  const location = useLocation();

  // /projects/:id/files/:fileId → "파일 상세"
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const isFilePage = pathSegments.includes("files");
  const currentPage = pathSegments[pathSegments.length - 1] ?? "";
  const pageName = isFilePage ? "파일 상세" : (pageNames[currentPage] ?? currentPage);

  if (!project) {
    return <h2 className="page-title">프로젝트를 찾을 수 없습니다</h2>;
  }

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/dashboard" className="breadcrumb-link">프로젝트</Link>
        <ChevronRight size={14} className="breadcrumb-sep" />
        <Link to={`/projects/${projectId}/overview`} className="breadcrumb-link">{project.name}</Link>
        <ChevronRight size={14} className="breadcrumb-sep" />
        <span className="breadcrumb-current">{pageName}</span>
      </nav>
      <Outlet />
    </>
  );
};
