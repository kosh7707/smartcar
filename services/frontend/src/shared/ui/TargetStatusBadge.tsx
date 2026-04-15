import React from "react";
import type { BuildTargetStatus } from "@aegis/shared";
import { Circle, CheckCircle, Loader, XCircle, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; description: string; color: string; icon: "dot" | "check" | "spin" | "partial" | "fail" | "settings" }> = {
  discovered: { label: "감지됨", description: "빌드 타겟으로 감지되었습니다", color: "var(--cds-text-placeholder)", icon: "dot" },
  resolving: { label: "빌드 탐색 중", description: "Build Agent가 빌드 명령어를 탐색하고 있습니다", color: "var(--aegis-severity-low)", icon: "spin" },
  resolve_failed: { label: "빌드 탐색 실패", description: "빌드 명령어 자동 탐색에 실패했습니다. 수동 설정이 필요합니다", color: "var(--aegis-severity-high)", icon: "fail" },
  configured: { label: "설정 완료", description: "빌드 설정이 완료되어 빌드를 시작할 수 있습니다", color: "var(--cds-interactive)", icon: "settings" },
  building: { label: "빌드 중", description: "compile_commands.json 생성을 위해 빌드를 실행하고 있습니다", color: "var(--aegis-severity-low)", icon: "spin" },
  built: { label: "빌드 완료", description: "빌드가 완료되어 SAST 스캔 대기 중입니다", color: "var(--cds-support-success)", icon: "partial" },
  build_failed: { label: "빌드 실패", description: "빌드에 실패했습니다. 빌드 로그를 확인하세요", color: "var(--aegis-severity-high)", icon: "fail" },
  scanning: { label: "스캔 중", description: "SAST 도구로 정적 분석 스캔을 실행하고 있습니다", color: "var(--aegis-severity-low)", icon: "spin" },
  scanned: { label: "스캔 완료", description: "SAST 스캔이 완료되어 코드그래프 생성 대기 중입니다", color: "var(--cds-support-success)", icon: "partial" },
  scan_failed: { label: "스캔 실패", description: "SAST 스캔에 실패했습니다", color: "var(--aegis-severity-high)", icon: "fail" },
  graphing: { label: "그래프 생성 중", description: "Knowledge Base에 코드그래프를 적재하고 있습니다", color: "var(--aegis-severity-low)", icon: "spin" },
  graphed: { label: "그래프 완료", description: "코드그래프 적재가 완료되었습니다", color: "var(--cds-support-success)", icon: "partial" },
  graph_failed: { label: "그래프 실패", description: "코드그래프 생성에 실패했습니다", color: "var(--aegis-severity-high)", icon: "fail" },
  ready: { label: "분석 가능", description: "빌드, 스캔, 코드그래프가 모두 완료되어 분석을 실행할 수 있습니다", color: "var(--cds-support-success)", icon: "check" },
};

interface Props {
  status: BuildTargetStatus | string;
  size?: "sm" | "md";
}

export const TargetStatusBadge: React.FC<Props> = ({ status, size = "md" }) => {
  const config = STATUS_CONFIG[status] ?? { label: status, description: status, color: "var(--cds-text-placeholder)", icon: "dot" };
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
    <Badge
      variant="outline"
      className={`target-status-badge target-status-badge--${size} min-h-7 shrink-0 gap-1 rounded-full bg-background/90 px-2 font-medium ${size === "md" ? "text-sm" : "text-xs"}`}
      style={{ color: config.color, borderColor: config.color }}
      title={config.description}
    >
      {icon}
      {config.label}
    </Badge>
  );
};
