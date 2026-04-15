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
      className={cn(
        "sticky top-0 z-50 mb-4 flex items-center justify-between gap-3 border-b px-4 py-2 font-medium",
        isFailed
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-amber-300 bg-amber-50 text-amber-900",
      )}
    >
      <WifiOff size={16} />
      <div className="min-w-0 flex-1">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </div>
      {isFailed && (
        <Button
          onClick={() => window.location.reload()}
          className="ml-3 border-current bg-transparent text-inherit hover:bg-background/40"
          size="sm"
          variant="outline"
        >
          새로고침
        </Button>
      )}
    </Alert>
  );
};
