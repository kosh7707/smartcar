import React from "react";
import type { BuildTargetStatus } from "@aegis/shared";
import { Circle, CheckCircle, Loader, XCircle, Settings } from "lucide-react";
import "./TargetStatusBadge.css";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: "dot" | "check" | "spin" | "partial" | "fail" | "settings" }> = {
  discovered: { label: "감지됨", color: "var(--text-tertiary)", icon: "dot" },
  configured: { label: "설정 완료", color: "var(--accent)", icon: "settings" },
  building: { label: "빌드 중", color: "var(--severity-medium)", icon: "spin" },
  built: { label: "빌드 완료", color: "#22c55e", icon: "partial" },
  build_failed: { label: "빌드 실패", color: "var(--severity-high)", icon: "fail" },
  scanning: { label: "스캔 중", color: "var(--severity-medium)", icon: "spin" },
  scanned: { label: "스캔 완료", color: "#22c55e", icon: "partial" },
  scan_failed: { label: "스캔 실패", color: "var(--severity-high)", icon: "fail" },
  graphing: { label: "그래프 생성 중", color: "var(--severity-medium)", icon: "spin" },
  graphed: { label: "그래프 완료", color: "#22c55e", icon: "partial" },
  graph_failed: { label: "그래프 실패", color: "var(--severity-high)", icon: "fail" },
  ready: { label: "준비 완료", color: "#16a34a", icon: "check" },
};

interface Props {
  status: BuildTargetStatus | string;
  size?: "sm" | "md";
}

export const TargetStatusBadge: React.FC<Props> = ({ status, size = "md" }) => {
  const config = STATUS_CONFIG[status] ?? { label: status, color: "var(--text-tertiary)", icon: "dot" };
  const iconSize = size === "sm" ? 11 : 13;

  const icon = (() => {
    switch (config.icon) {
      case "spin": return <Loader size={iconSize} className="animate-spin" />;
      case "check": return <CheckCircle size={iconSize} />;
      case "partial": return <CheckCircle size={iconSize} />;
      case "fail": return <XCircle size={iconSize} />;
      case "settings": return <Settings size={iconSize} />;
      default: return <Circle size={iconSize} />;
    }
  })();

  return (
    <span
      className={`target-status-badge target-status-badge--${size}`}
      style={{ color: config.color, borderColor: config.color }}
    >
      {icon}
      {config.label}
    </span>
  );
};
