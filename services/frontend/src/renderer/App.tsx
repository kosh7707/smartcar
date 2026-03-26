import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProjectProvider } from "./contexts/ProjectContext";
import { ToastProvider } from "./contexts/ToastContext";
import { AnalysisGuardProvider } from "./contexts/AnalysisGuardContext";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProjectLayout } from "./layouts/ProjectLayout";
import { ProjectsPage } from "./pages/ProjectsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { StaticAnalysisPage } from "./pages/StaticAnalysisPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";
import { FileDetailPage } from "./pages/FileDetailPage";
import { FilesPage } from "./pages/FilesPage";
import { VulnerabilitiesPage } from "./pages/VulnerabilitiesPage";
import { AnalysisHistoryPage } from "./pages/AnalysisHistoryPage";
import { ReportPage } from "./pages/ReportPage";
import { QualityGatePage } from "./pages/QualityGatePage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { SdkManagementPage } from "./pages/SdkManagementPage";
import { ComingSoonPlaceholder } from "./components/ui";

export const App: React.FC = () => {
  return (
    <HashRouter>
      <ToastProvider>
        <AnalysisGuardProvider>
        <ProjectProvider>
          <div className="app-layout">
            <Sidebar />
            <div className="main-area">
              <div className="content">
                <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Navigate to="/projects" replace />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:projectId" element={<ProjectLayout />}>
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
                    <Route path="sdk" element={<SdkManagementPage />} />
                    <Route path="dynamic-analysis" element={<ComingSoonPlaceholder title="동적 분석" />} />
                    <Route path="dynamic-test" element={<ComingSoonPlaceholder title="동적 테스트" />} />
                    <Route path="settings" element={<ProjectSettingsPage />} />
                  </Route>
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
                </ErrorBoundary>
              </div>
              <StatusBar />
            </div>
          </div>
        </ProjectProvider>
        </AnalysisGuardProvider>
      </ToastProvider>
    </HashRouter>
  );
};
