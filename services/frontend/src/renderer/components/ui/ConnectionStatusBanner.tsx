import React from "react";
import type { ConnectionState } from "../../utils/wsEnvelope";

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
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: 500,
        background: isFailed ? "var(--danger-bg, #fde8e8)" : "var(--warning-bg, #fef3cd)",
        color: isFailed ? "var(--danger, #dc3545)" : "var(--warning-text, #856404)",
        borderBottom: `1px solid ${isFailed ? "var(--danger-border, #f5c6cb)" : "var(--warning-border, #ffc107)"}`,
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
          style={{
            marginLeft: 8,
            padding: "2px 10px",
            fontSize: 12,
            border: "1px solid currentColor",
            borderRadius: 4,
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          새로고침
        </button>
      )}
    </div>
  );
};
