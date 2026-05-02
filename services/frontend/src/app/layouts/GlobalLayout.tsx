import React from "react";
import { NotificationProvider } from "@/common/contexts/NotificationContext";
import { Navbar } from "@/common/ui/chrome/Navbar";
import { ErrorBoundary } from "@/common/ui/chrome/ErrorBoundary";

interface GlobalLayoutProps {
  children: React.ReactNode;
}

export const GlobalLayout: React.FC<GlobalLayoutProps> = ({ children }) => (
  <NotificationProvider>
    <div className="app-shell">
      <Navbar />
      <div className="app-scroll-region">
        <div className="global-shell-inner">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </div>
    </div>
  </NotificationProvider>
);
