import React from "react";
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

  return (
    <div role="status" className={bannerClassName}>
      <span>
        {isFailed
          ? "연결 실패 — 새로고침 필요"
          : `연결 끊김 — 재연결 중...${retryCount != null ? ` (시도 ${retryCount})` : ""}`}
      </span>
      {isFailed && (
        <button
          onClick={() => window.location.reload()}
          className="connection-status-banner__reload-btn"
        >
          새로고침
        </button>
      )}
    </div>
  );
};
