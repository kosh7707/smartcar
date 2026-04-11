import React from "react";
import { Shield } from "lucide-react";
import { AttentionProjectCard } from "./AttentionProjectCard";
import { DashboardEmptySurface } from "./DashboardEmptySurface";
import { DashboardSectionHeading } from "./DashboardSectionHeading";
import type { DashboardProject } from "../dashboardTypes";

interface NeedsAttentionSectionProps {
  projects: DashboardProject[];
  nextMoveProject: DashboardProject | null;
}

export const NeedsAttentionSection: React.FC<NeedsAttentionSectionProps> = ({ projects, nextMoveProject }) => {
  return (
    <section className="dashboard-section dashboard-section--attention">
      <DashboardSectionHeading title="우선 확인" />

      {projects.length === 0 ? (
        <DashboardEmptySurface
          tone="attention"
          icon={<Shield size={22} />}
          title="긴급 항목 없음"
          description={
            nextMoveProject
              ? "지금은 즉시 대응할 경고가 없습니다. 최근 프로젝트 상태를 한 번 점검해두면 충분합니다."
              : "프로젝트를 생성하면 게이트 실패나 높은 위험 항목이 이곳에 우선 정렬됩니다."
          }
          variant="panel"
        />
      ) : (
        <div className="needs-attention-list">
          {projects.map((project) => <AttentionProjectCard key={project.id} project={project} />)}
        </div>
      )}
    </section>
  );
};
