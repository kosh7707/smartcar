import React from "react";
import { NotificationProvider } from "../contexts/NotificationContext";
import { Navbar } from "./Navbar";
import { ErrorBoundary } from "./ErrorBoundary";

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
