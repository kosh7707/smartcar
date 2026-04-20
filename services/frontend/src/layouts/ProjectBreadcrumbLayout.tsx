import React from "react";
import { Outlet, useParams, Link, useLocation } from "react-router-dom";
import { useProjects } from "../contexts/ProjectContext";
import { PageHeader } from "../shared/ui";

const pageNames: Record<string, string> = {
  overview: "개요",
  "static-analysis": "정적 분석",
  files: "파일 탐색기",
  vulnerabilities: "취약점 목록",
  "analysis-history": "분석 이력",
  report: "보고서",
  settings: "프로젝트 설정",
  "quality-gate": "품질 게이트",
  approvals: "승인 큐",
  "dynamic-analysis": "동적 분석",
  "dynamic-test": "동적 테스트",
};

export const ProjectBreadcrumbLayout: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { getProject } = useProjects();
  const project = projectId ? getProject(projectId) : null;
  const location = useLocation();

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const isFileDetailPage = pathSegments[pathSegments.length - 2] === "files";
  const currentPage = pathSegments[pathSegments.length - 1] ?? "";
  const pageName = isFileDetailPage ? "파일 상세" : (pageNames[currentPage] ?? currentPage);

  if (!project) {
    return (
      <div className="page-shell">
        <PageHeader surface="plain" title="프로젝트를 찾을 수 없습니다" subtitle="삭제되었거나 현재 접근할 수 없는 프로젝트입니다." />
      </div>
    );
  }

  return (
    <>
      <nav className="page-breadcrumbs" aria-label="프로젝트 경로">
        <Link to="/dashboard">프로젝트</Link>
        <span>/</span>
        <Link to={`/projects/${projectId}/overview`} title={project.name}>{project.name}</Link>
        <span>/</span>
        <span className="current breadcrumb-current" aria-current="page" title={pageName}>{pageName}</span>
      </nav>
      <Outlet />
    </>
  );
};
