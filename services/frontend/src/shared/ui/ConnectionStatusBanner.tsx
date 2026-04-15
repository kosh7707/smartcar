import React from "react";
import { WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ConnectionState } from "../../utils/wsEnvelope";
import "./ConnectionStatusBanner.css";

interface Props {
  connectionState: ConnectionState;
  retryCount?: number;
}

export const ConnectionStatusBanner: React.FC<Props> = ({ connectionState, retryCount }) => {
  if (connectionState === "connected" || connectionState === "disconnected") return null;

  const isFailed = connectionState === "failed";
  const bannerClassName = `connection-status-banner connection-status-banner--${isFailed ? "failed" : "reconnecting"}`;
  const title = isFailed ? "연결 실패" : "연결 끊김";
  const description = isFailed
    ? "새로고침 필요"
    : `재연결 중...${retryCount != null ? ` (시도 ${retryCount})` : ""}`;

  return (
    <Alert role="status" variant={isFailed ? "destructive" : "default"} className={`${bannerClassName} mb-4 flex items-center justify-between gap-3`}>
      <WifiOff size={16} />
      <div className="min-w-0 flex-1">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </div>
      {isFailed && (
        <Button
          onClick={() => window.location.reload()}
          className="connection-status-banner__reload-btn"
          size="sm"
          variant="outline"
        >
          새로고침
        </Button>
      )}
    </Alert>
  );
};
