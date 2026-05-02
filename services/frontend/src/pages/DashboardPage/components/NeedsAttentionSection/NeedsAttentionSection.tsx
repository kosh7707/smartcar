import "./NeedsAttentionSection.css";
import React from "react";
import { AttentionProjectCard } from "../AttentionProjectCard/AttentionProjectCard";
import { DashboardEmptySurface } from "../DashboardEmptySurface/DashboardEmptySurface";
import type { DashboardProject } from "../../dashboardTypes";

interface NeedsAttentionSectionProps {
  projects: DashboardProject[];
  hasProjectContext: boolean;
}

export const NeedsAttentionSection: React.FC<NeedsAttentionSectionProps> = ({ projects, hasProjectContext }) => (
  <section>
    <div className="section-head">
      <h2>주의 필요 <span className="count">{projects.length}</span></h2>
      <span className="hint">최근 24시간 기준 · 자동 우선순위</span>
    </div>
    {projects.length === 0 ? (
      <DashboardEmptySurface
        tone="attention"
        title="긴급 항목 없음"
        description={hasProjectContext ? "지금은 즉시 대응할 경고가 없습니다. 최근 프로젝트 상태를 한 번 점검해두면 충분합니다." : "프로젝트를 생성하면 게이트 실패나 높은 위험 항목이 이곳에 우선 정렬됩니다."}
        variant="panel"
      />
    ) : (
      <div className="attention-grid">
        {projects.map((project) => <AttentionProjectCard key={project.id} project={project} />)}
      </div>
    )}
  </section>
);
