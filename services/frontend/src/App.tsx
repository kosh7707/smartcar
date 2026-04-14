import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
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

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const AuthEntryRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

const HomeRedirect: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AnalysisGuardProvider>
            <ProjectProvider>
              <Routes>
                <Route path="/login" element={<AuthEntryRoute><LoginPage /></AuthEntryRoute>} />
                <Route path="/signup" element={<AuthEntryRoute><SignupPage /></AuthEntryRoute>} />

                <Route path="/dashboard" element={
                  <RequireAuth>
                    <DashboardLayout>
                      <DashboardPage />
                    </DashboardLayout>
                  </RequireAuth>
                } />
                <Route path="/settings" element={
                  <RequireAuth>
                    <GlobalLayout>
                      <SettingsPage />
                    </GlobalLayout>
                  </RequireAuth>
                } />

                <Route path="/projects/:projectId/*" element={<RequireAuth><ProjectLayoutShell /></RequireAuth>} />

                <Route path="/" element={<HomeRedirect />} />
                <Route path="/projects" element={<HomeRedirect />} />
                <Route path="*" element={<HomeRedirect />} />
              </Routes>
            </ProjectProvider>
          </AnalysisGuardProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};
