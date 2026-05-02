import React from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/common/utils/cn";
import type { ConnectionState } from "@/common/utils/wsEnvelope";
import "./ConnectionStatusBanner.css";

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
    <div
      role="status"
      className={cn(
        "connection-status-banner",
        isFailed ? "is-failed" : "is-reconnecting",
      )}
    >
      <WifiOff size={16} className="connection-status-banner__icon" aria-hidden="true" />
      <div className="connection-status-banner__copy">
        <strong className="connection-status-banner__title">{title}</strong>
        <span className="connection-status-banner__description">{description}</span>
      </div>
      {isFailed ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-outline btn-sm connection-status-banner__action"
        >
          새로고침
        </button>
      ) : null}
    </div>
  );
};
