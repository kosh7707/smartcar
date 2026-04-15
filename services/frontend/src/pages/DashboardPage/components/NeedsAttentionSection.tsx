import React from "react";
import { AttentionProjectCard } from "./AttentionProjectCard";
import { DashboardEmptySurface } from "./DashboardEmptySurface";
import type { DashboardProject } from "../dashboardTypes";

interface NeedsAttentionSectionProps {
  projects: DashboardProject[];
  hasProjectContext: boolean;
}

export const NeedsAttentionSection: React.FC<NeedsAttentionSectionProps> = ({ projects, hasProjectContext }) => {
  return (
    <section className="flex min-w-0 flex-col gap-3 p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="m-0 text-lg font-semibold tracking-tight text-foreground">우선 확인</h2>
      </div>

      {projects.length === 0 ? (
        <DashboardEmptySurface
          tone="attention"
          title="긴급 항목 없음"
          description={
            hasProjectContext
              ? "지금은 즉시 대응할 경고가 없습니다. 최근 프로젝트 상태를 한 번 점검해두면 충분합니다."
              : "프로젝트를 생성하면 게이트 실패나 높은 위험 항목이 이곳에 우선 정렬됩니다."
          }
          variant="panel"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {projects.map((project) => <AttentionProjectCard key={project.id} project={project} />)}
        </div>
      )}
    </section>
  );
};
