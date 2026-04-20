import React from "react";
import { Button } from "@/components/ui/button";
import type { ConnectionState } from "../../../utils/wsEnvelope";
import type { ActivityEvent } from "../dashboardTypes";
import { ActivityEventCard } from "./ActivityEventCard";
import { DashboardEmptySurface } from "./DashboardEmptySurface";

interface RecentActivitySectionProps {
  visibleActivity: ActivityEvent[];
  hasMore: boolean;
  onLoadMore: () => void;
  connectionState: ConnectionState;
}

function liveSignalCopy(connectionState: ConnectionState): { label: string; tone: "connected" | "reconnecting" | "disconnected" } {
  if (connectionState === "connected") {
    return { label: "WS 연결됨 · 실시간 스트림", tone: "connected" };
  }

  if (connectionState === "reconnecting") {
    return { label: "WS 재연결 중 · 스트림 복구 대기", tone: "reconnecting" };
  }

  return { label: "WS 연결 끊김 · REST 스냅샷 기준", tone: "disconnected" };
}

export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  visibleActivity,
  hasMore,
  onLoadMore,
  connectionState,
}) => {
  const liveSignal = liveSignalCopy(connectionState);

  return (
    <aside className="activity">
      <div className="panel">
        <div className="panel-head"><h3>최근 활동</h3></div>
        <div className="activity-body">
          {visibleActivity.length === 0 ? (
            <DashboardEmptySurface title="아직 활동 없음" description="첫 업로드, 분석, 승인 같은 작업이 시작되면 최근 흐름이 이 레인에 순서대로 쌓입니다." variant="panel" />
          ) : (
            visibleActivity.map((event) => <ActivityEventCard key={event.id} event={event} />)
          )}
          {hasMore ? <div className="activity-load-more"><Button type="button" variant="outline" size="sm" onClick={onLoadMore}>더 보기</Button></div> : null}
        </div>
        <div className={`activity-foot activity-foot--${liveSignal.tone}`} aria-live="polite">
          <span className="live-dot"></span>
          {liveSignal.label}
        </div>
      </div>
    </aside>
  );
};
