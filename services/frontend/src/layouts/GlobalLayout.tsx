import React from "react";
import { NotificationProvider } from "../contexts/NotificationContext";
import { Navbar } from "./Navbar";
import { ErrorBoundary } from "./ErrorBoundary";

interface GlobalLayoutProps {
  children: React.ReactNode;
}

/**
 * Navbar + full-width content area for global surfaces.
 */
export const GlobalLayout: React.FC<GlobalLayoutProps> = ({ children }) => (
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
