import React from "react";
import { NotificationProvider } from "../contexts/NotificationContext";
import { Navbar } from "../components/Navbar";
import { ErrorBoundary } from "../components/ErrorBoundary";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Navbar + edge-to-edge content area for the dashboard surface.
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => (
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
