import React from "react";
import { NotificationProvider } from "@/common/contexts/NotificationContext";
import { Navbar } from "@/common/ui/chrome/Navbar";
import { ErrorBoundary } from "@/common/ui/chrome/ErrorBoundary";

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
