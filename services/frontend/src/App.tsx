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
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage/ResetPasswordPage";
import { DashboardPage } from "./pages/DashboardPage/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage/SettingsPage";
import { AdminRegistrationsPage } from "./pages/AdminRegistrationsPage/AdminRegistrationsPage";

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

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
                <Route path="/forgot-password" element={<AuthEntryRoute><ForgotPasswordPage /></AuthEntryRoute>} />
                <Route path="/reset-password" element={<AuthEntryRoute><ResetPasswordPage /></AuthEntryRoute>} />

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
                <Route path="/admin/registrations" element={
                  <RequireAdmin>
                    <GlobalLayout>
                      <AdminRegistrationsPage />
                    </GlobalLayout>
                  </RequireAdmin>
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
