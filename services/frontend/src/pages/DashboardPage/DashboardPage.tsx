import React from "react";
import { useProjects } from "../../contexts/ProjectContext";
import { NeedsAttentionSection } from "./components/NeedsAttentionSection";
import { ProjectExplorer } from "./components/ProjectExplorer";
import { RecentActivitySection } from "./components/RecentActivitySection";
import { getDashboardAttentionState } from "./dashboardAttentionState";
import { useDashboardActivityFeed } from "./useDashboardActivityFeed";
import { useDashboardCreateForm } from "./useDashboardCreateForm";
import { useDashboardDocumentTitle } from "./useDashboardDocumentTitle";
import { useDashboardExplorerState } from "./useDashboardExplorerState";
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

  const {
    showCreate,
    name,
    desc,
    setName,
    setDesc,
    toggleCreate,
    handleCreate,
    handleCancelCreate,
  } = useDashboardCreateForm({ createProject });

  return (
    <div className="dashboard">
      <div className="dashboard-body">
        <ProjectExplorer
          projects={filteredProjects}
          filter={filter}
          emptyState={emptyState}
          onFilterChange={setFilter}
          createFlow={{
            show: showCreate,
            name,
            description: desc,
            onToggle: toggleCreate,
            onNameChange: setName,
            onDescriptionChange: setDesc,
            onSubmit: handleCreate,
            onCancel: handleCancelCreate,
          }}
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
