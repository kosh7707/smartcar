import React from "react";
import { Button } from "@/components/ui/button";
import type { ActivityEvent } from "../dashboardTypes";
import { ActivityEventCard } from "./ActivityEventCard";
import { DashboardEmptySurface } from "./DashboardEmptySurface";

interface RecentActivitySectionProps { visibleActivity: ActivityEvent[]; hasMore: boolean; onLoadMore: () => void; }

export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({ visibleActivity, hasMore, onLoadMore }) => {
  return (
    <section className="flex min-w-0 flex-col gap-3 p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3"><h2 className="m-0 text-lg font-semibold tracking-tight text-foreground">최근 활동</h2></div>
      {visibleActivity.length === 0 ? (
        <DashboardEmptySurface title="아직 활동 없음" description="첫 업로드, 분석, 승인 같은 작업이 시작되면 최근 흐름이 이 레인에 순서대로 쌓입니다." variant="panel" />
      ) : (
        <div className="flex flex-col">{visibleActivity.map((event) => <ActivityEventCard key={event.id} event={event} />)}</div>
      )}
      {hasMore && <div className="flex justify-center pt-2"><Button type="button" variant="outline" size="sm" onClick={onLoadMore}>더 보기</Button></div>}
    </section>
  );
};
