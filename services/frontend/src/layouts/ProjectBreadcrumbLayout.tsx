import React from "react";
import { Outlet, useParams, Link, useLocation } from "react-router-dom";
import { useProjects } from "../contexts/ProjectContext";
import { PageHeader } from "../shared/ui";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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

  // /projects/:id/files/:fileId → "파일 상세"
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const isFileDetailPage = pathSegments[pathSegments.length - 2] === "files";
  const currentPage = pathSegments[pathSegments.length - 1] ?? "";
  const pageName = isFileDetailPage ? "파일 상세" : (pageNames[currentPage] ?? currentPage);

  if (!project) {
    return (
      <div className="page-enter">
        <PageHeader
          surface="plain"
          title="프로젝트를 찾을 수 없습니다"
          subtitle="삭제되었거나 현재 접근할 수 없는 프로젝트입니다."
        />
      </div>
    );
  }

  return (
    <>
      <Breadcrumb className="mb-4 min-w-0" aria-label="프로젝트 경로">
        <BreadcrumbList className="min-w-0">
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbLink asChild className="max-w-56 truncate font-medium">
              <Link to="/dashboard">프로젝트</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem className="min-w-0">
            <BreadcrumbLink asChild className="max-w-56 truncate font-medium" title={project.name}>
              <Link to={`/projects/${projectId}/overview`}>{project.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="breadcrumb-current max-w-56 truncate font-semibold" title={pageName}>
              {pageName}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Outlet />
    </>
  );
};
