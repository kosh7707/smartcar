import React from "react";
import { NotificationProvider } from "../contexts/NotificationContext";
import { Navbar } from "./Navbar";
import { ErrorBoundary } from "./ErrorBoundary";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => (
  <NotificationProvider>
    <div className="app-shell">
      <Navbar />
      <div className="app-scroll-region">
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  </NotificationProvider>
);
