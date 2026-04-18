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
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <div className="mx-auto w-full max-w-[1280px] flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f4f6fa_0%,var(--cds-background)_14rem)] px-8 py-7">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  </NotificationProvider>
);
