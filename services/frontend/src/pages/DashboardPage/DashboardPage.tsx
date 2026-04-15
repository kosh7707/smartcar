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
    <div className="flex min-h-full flex-col px-7 py-6 pb-7 max-[980px]:px-5 max-[980px]:py-4 max-[640px]:p-4">
      <div className="grid grid-cols-[minmax(18rem,21rem)_minmax(0,1fr)] items-start gap-5 max-[980px]:flex max-[980px]:flex-col">
        <ProjectExplorer
          projects={filteredProjects}
          filter={filter}
          emptyState={emptyState}
          onFilterChange={setFilter}
          createFlow={createFlow}
        />

        <main className="flex min-w-0">
          <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5 max-[980px]:mx-0 max-[980px]:max-w-none">
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
