import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { ToastProvider } from "./contexts/ToastContext";
import { AnalysisGuardProvider } from "./contexts/AnalysisGuardContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProjectLayout } from "./layouts/ProjectLayout";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage/DashboardPage";
import { OverviewPage } from "./pages/OverviewPage/OverviewPage";
import { StaticAnalysisPage } from "./pages/StaticAnalysisPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage/ProjectSettingsPage";
import { FileDetailPage } from "./pages/FileDetailPage";
import { FilesPage } from "./pages/FilesPage";
import { VulnerabilitiesPage } from "./pages/VulnerabilitiesPage";
import { AnalysisHistoryPage } from "./pages/AnalysisHistoryPage";
import { ReportPage } from "./pages/ReportPage";
import { QualityGatePage } from "./pages/QualityGatePage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { DynamicAnalysisPage } from "./pages/DynamicAnalysisPage";
import { DynamicTestPage } from "./pages/DynamicTestPage";

/** Extracts projectId from the current URL path and wraps children with NotificationProvider. */
const NotificationBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const match = location.pathname.match(/^\/projects\/([^/]+)/);
  return (
    <NotificationProvider projectId={match?.[1]}>
      {children}
    </NotificationProvider>
  );
};

/** Global layout: Navbar + full-width content (no sidebar). */
const GlobalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <div className="layout-global">
      <Navbar />
      <div className="layout-global__content">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  </NotificationProvider>
);

/** Dashboard layout: Navbar + edge-to-edge content (no max-width). */
const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <div className="layout-dashboard">
      <Navbar />
      <div className="layout-dashboard__content">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  </NotificationProvider>
);

/** Project layout: Navbar + Sidebar + content. */
const ProjectLayoutShell: React.FC = () => (
  <NotificationBridge>
    <div className="layout-project">
      <Navbar />
      <div className="layout-project__body">
        <Sidebar />
        <div className="layout-project__content">
          <div className="layout-project__main">
            <ErrorBoundary>
              <Routes>
                <Route element={<ProjectLayout />}>
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

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AnalysisGuardProvider>
            <ProjectProvider>
              <Routes>
                {/* Auth layout — no navbar, no sidebar */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />

                {/* Global layout — navbar + full-width content */}
                <Route path="/dashboard" element={
                  <DashboardLayout>
                    <DashboardPage />
                  </DashboardLayout>
                } />
                <Route path="/settings" element={
                  <GlobalLayout>
                    <SettingsPage />
                  </GlobalLayout>
                } />

                {/* Project layout — navbar + sidebar + content */}
                <Route path="/projects/:projectId/*" element={<ProjectLayoutShell />} />

                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/projects" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </ProjectProvider>
          </AnalysisGuardProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};
