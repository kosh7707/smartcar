import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { ErrorBoundary } from "./ErrorBoundary";
import { OverviewPage } from "../pages/OverviewPage/OverviewPage";
import { StaticAnalysisPage } from "../pages/StaticAnalysisPage/StaticAnalysisPage";
import { FilesPage } from "../pages/FilesPage/FilesPage";
import { FileDetailPage } from "../pages/FileDetailPage/FileDetailPage";
import { VulnerabilitiesPage } from "../pages/VulnerabilitiesPage";
import { AnalysisHistoryPage } from "../pages/AnalysisHistoryPage/AnalysisHistoryPage";
import { ReportPage } from "../pages/ReportPage/ReportPage";
import { QualityGatePage } from "../pages/QualityGatePage/QualityGatePage";
import { ApprovalsPage } from "../pages/ApprovalsPage/ApprovalsPage";
import { DynamicAnalysisPage } from "../pages/DynamicAnalysisPage/DynamicAnalysisPage";
import { DynamicTestPage } from "../pages/DynamicTestPage/DynamicTestPage";
import { ProjectSettingsPage } from "../pages/ProjectSettingsPage/ProjectSettingsPage";
import { ProjectBreadcrumbLayout } from "./ProjectBreadcrumbLayout";
import { NotificationBridge } from "./NotificationBridge";

/**
 * Navbar + sidebar shell for all /projects/:projectId/* routes.
 */
export const ProjectLayoutShell: React.FC = () => (
  <NotificationBridge>
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#f4f6fa_0%,var(--cds-background)_12rem)]">
          <div className="flex-1 overflow-y-auto p-7">
            <ErrorBoundary>
              <Routes>
                <Route element={<ProjectBreadcrumbLayout />}>
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<OverviewPage />} />
                  <Route path="static-analysis" element={<StaticAnalysisPage />} />
                  <Route path="files" element={<FilesPage />} />
                  <Route path="files/:fileId" element={<FileDetailPage />} />
                  <Route path="vulnerabilities" element={<VulnerabilitiesPage />} />
                  <Route path="analysis-history" element={<AnalysisHistoryPage />} />
                  <Route path="report" element={<ReportPage />} />
                  <Route path="quality-gate" element={<QualityGatePage />} />
                  <Route path="approvals" element={<ApprovalsPage />} />
                  <Route path="dynamic-analysis" element={<DynamicAnalysisPage />} />
                  <Route path="dynamic-test" element={<DynamicTestPage />} />
                  <Route path="settings" element={<ProjectSettingsPage />} />
                </Route>
              </Routes>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  </NotificationBridge>
);
