import React from "react";
import { WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConnectionState } from "../../utils/wsEnvelope";

interface Props {
  connectionState: ConnectionState;
  retryCount?: number;
}

export const ConnectionStatusBanner: React.FC<Props> = ({ connectionState, retryCount }) => {
  if (connectionState === "connected" || connectionState === "disconnected") return null;

  const isFailed = connectionState === "failed";
  const title = isFailed ? "연결 실패" : "연결 끊김";
  const description = isFailed
    ? "새로고침 필요"
    : `재연결 중...${retryCount != null ? ` (시도 ${retryCount})` : ""}`;

  return (
    <Alert
      role="status"
      variant={isFailed ? "destructive" : "default"}
      className={cn("connection-status-banner", isFailed ? "is-failed" : "is-reconnecting")}
    >
      <WifiOff size={16} className="connection-status-banner__icon" />
      <div className="connection-status-banner__copy">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </div>
      {isFailed ? (
        <Button
          onClick={() => window.location.reload()}
          className="connection-status-banner__action"
          size="sm"
          variant="outline"
        >
          새로고침
        </Button>
      ) : null}
    </Alert>
  );
};
