import React from "react";
import { useProjects } from "../../contexts/ProjectContext";
import { NeedsAttentionSection } from "./components/NeedsAttentionSection";
import { ProjectExplorer } from "./components/ProjectExplorer";
import { RecentActivitySection } from "./components/RecentActivitySection";
import { getDashboardAttentionState } from "./dashboardAttentionState";
import { useDashboardActivityFeed } from "./hooks/useDashboardActivityFeed";
import { useDashboardCreateForm } from "./hooks/useDashboardCreateForm";
import { useDashboardDocumentTitle } from "./hooks/useDashboardDocumentTitle";
import { useDashboardExplorerState } from "./hooks/useDashboardExplorerState";
import "./dashboardTokens.css";
import "./DashboardPage.css";

export const DashboardPage: React.FC = () => {
  const { projects, loading, createProject } = useProjects();
  useDashboardDocumentTitle();

  const {
    filter,
    setFilter,
    filteredProjects,
    emptyState,
  } = useDashboardExplorerState({
    projects,
    loading,
  });
  const { attentionProjects, hasProjectContext } = getDashboardAttentionState({
    projects,
    filteredProjects,
  });
  const { visibleActivity, hasMore, loadMore } = useDashboardActivityFeed({ projects });
  const { createFlow } = useDashboardCreateForm({ createProject });

  return (
    <div className="dashboard">
      <div className="dashboard-body">
        <ProjectExplorer
          projects={filteredProjects}
          filter={filter}
          emptyState={emptyState}
          onFilterChange={setFilter}
          createFlow={createFlow}
        />

        <main className="dashboard-main">
          <div className="dashboard-main__lane">
            <NeedsAttentionSection
              projects={attentionProjects}
              hasProjectContext={hasProjectContext}
            />
            <RecentActivitySection
              visibleActivity={visibleActivity}
              hasMore={hasMore}
              onLoadMore={loadMore}
            />
          </div>
        </main>
      </div>
    </div>
  );
};
