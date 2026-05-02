import React from "react";
import { useLocation } from "react-router-dom";
import { NotificationProvider } from "@/common/contexts/NotificationContext";

interface NotificationBridgeProps {
  children: React.ReactNode;
}

/**
 * Extracts projectId from the current URL path and wraps children with NotificationProvider.
 */
export const NotificationBridge: React.FC<NotificationBridgeProps> = ({ children }) => {
  const location = useLocation();
  const match = location.pathname.match(/^\/projects\/([^/]+)/);

  return (
    <NotificationProvider projectId={match?.[1]}>
      {children}
    </NotificationProvider>
  );
};
