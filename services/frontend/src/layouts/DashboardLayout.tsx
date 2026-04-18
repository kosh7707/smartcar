import React from "react";
import { NotificationProvider } from "../contexts/NotificationContext";
import { Navbar } from "./Navbar";
import { ErrorBoundary } from "./ErrorBoundary";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Navbar + edge-to-edge content area for the dashboard surface.
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => (
  <NotificationProvider>
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f4f6fa_0%,var(--cds-background)_12rem)]">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  </NotificationProvider>
);
