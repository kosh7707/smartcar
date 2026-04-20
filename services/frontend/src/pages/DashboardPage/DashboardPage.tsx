import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useProjects } from "../../contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { NeedsAttentionSection } from "./components/NeedsAttentionSection";
import { ProjectExplorer } from "./components/ProjectExplorer";
import { RecentActivitySection } from "./components/RecentActivitySection";
import { criticalOpenTotal, latestSyncLabel, pendingApprovalsTotal } from "./dashboardProjectSignals";
import { getDashboardAttentionState } from "./dashboardAttentionState";
import { useDashboardActivityFeed } from "./hooks/useDashboardActivityFeed";
import { useDashboardCreateForm } from "./hooks/useDashboardCreateForm";
import { useDashboardDocumentTitle } from "./hooks/useDashboardDocumentTitle";
import { useDashboardExplorerState } from "./hooks/useDashboardExplorerState";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const greetingName = user?.displayName || user?.username || "보안 분석가";
  const { projects, loading, createProject } = useProjects();

  useDashboardDocumentTitle();

  const { filter, setFilter, filteredProjects, emptyState } = useDashboardExplorerState({ projects, loading });
  const { attentionProjects, hasProjectContext } = getDashboardAttentionState({ projects, filteredProjects });
  const { visibleActivity, hasMore, loadMore, connectionState } = useDashboardActivityFeed({ projects });
  const { createFlow } = useDashboardCreateForm({ createProject });
  const criticalOpen = criticalOpenTotal(projects);
  const pendingApprovals = pendingApprovalsTotal(projects);
  const latestSync = latestSyncLabel(projects);

  return (
    <main className="main">
      <header className="page-head" data-chore>
        <div className="chore c-1">
          <h1>안녕하세요, {greetingName} <em>— 오늘 주의 필요 <span className="crit-n">{attentionProjects.length}건</span></em></h1>
          <div className="sub">
            <span><b>{projects.length}</b> 프로젝트 활성</span>
            <span className="sep">·</span>
            <span><span className="critical">{criticalOpen} critical</span> open</span>
            <span className="sep">·</span>
            <span><b>{pendingApprovals}</b> 승인 대기</span>
            <span className="sep">·</span>
            <span>마지막 동기화 {latestSync} UTC+9</span>
          </div>
        </div>
        <div className="actions chore c-2">
          <Button type="button" size="sm" onClick={createFlow.onToggle}>새 프로젝트</Button>
        </div>
      </header>

      <NeedsAttentionSection projects={attentionProjects} hasProjectContext={hasProjectContext} />

      <div className="cols" data-chore>
        <section className="chore c-3">
          <ProjectExplorer projects={filteredProjects} filter={filter} emptyState={emptyState} onFilterChange={setFilter} createFlow={createFlow} />
        </section>
        <section className="chore c-4">
          <RecentActivitySection visibleActivity={visibleActivity} hasMore={hasMore} onLoadMore={loadMore} connectionState={connectionState} />
        </section>
      </div>
    </main>
  );
};
