import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { ToastProvider } from "./contexts/ToastContext";
import { AnalysisGuardProvider } from "./contexts/AnalysisGuardContext";
import { GlobalLayout } from "./layouts/GlobalLayout";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ProjectLayoutShell } from "./layouts/ProjectLayoutShell";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { SignupPage } from "./pages/SignupPage/SignupPage";
import { DashboardPage } from "./pages/DashboardPage/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage/SettingsPage";

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
