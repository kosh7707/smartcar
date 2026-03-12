import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProjectProvider } from "./contexts/ProjectContext";
import { ToastProvider } from "./contexts/ToastContext";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProjectLayout } from "./layouts/ProjectLayout";
import { ProjectsPage } from "./pages/ProjectsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { StaticAnalysisPage } from "./pages/StaticAnalysisPage";
import { DynamicAnalysisPage } from "./pages/DynamicAnalysisPage";
import { DynamicTestPage } from "./pages/DynamicTestPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";
import { FileDetailPage } from "./pages/FileDetailPage";
import { FilesPage } from "./pages/FilesPage";
import { VulnerabilitiesPage } from "./pages/VulnerabilitiesPage";
import { AnalysisHistoryPage } from "./pages/AnalysisHistoryPage";

export const App: React.FC = () => {
  return (
    <HashRouter>
      <ToastProvider>
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
                    <Route path="dynamic-analysis" element={<DynamicAnalysisPage />} />
                    <Route path="dynamic-test" element={<DynamicTestPage />} />
                    <Route path="files" element={<FilesPage />} />
                    <Route path="files/:fileId" element={<FileDetailPage />} />
                    <Route path="vulnerabilities" element={<VulnerabilitiesPage />} />
                    <Route path="analysis-history" element={<AnalysisHistoryPage />} />
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
      </ToastProvider>
    </HashRouter>
  );
};
