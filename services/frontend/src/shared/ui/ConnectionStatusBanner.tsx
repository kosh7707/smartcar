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

  return (
    <div
      role="status"
      className="connection-status-banner"
      style={{
        background: isFailed ? "var(--cds-support-error-bg, #fde8e8)" : "var(--cds-support-warning-bg, #fef3cd)",
        color: isFailed ? "var(--cds-support-error, #dc3545)" : "var(--cds-support-warning-text, #856404)",
        borderBottom: `1px solid ${isFailed ? "var(--cds-support-error-border, #f5c6cb)" : "var(--cds-support-warning-border, #ffc107)"}`,
      }}
    >
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
