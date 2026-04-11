import React from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "../../contexts/ProjectContext";
import { NeedsAttentionSection } from "./components/NeedsAttentionSection";
import { ProjectExplorer } from "./components/ProjectExplorer";
import { RecentActivitySection } from "./components/RecentActivitySection";
import { useDashboardAttention } from "./useDashboardAttention";
import { useDashboardActivityFeed } from "./useDashboardActivityFeed";
import { useDashboardCreateForm } from "./useDashboardCreateForm";
import { useDashboardDocumentTitle } from "./useDashboardDocumentTitle";
import { useDashboardExplorerFilter } from "./useDashboardExplorerFilter";
import "./dashboardTokens.css";
import "./DashboardPage.css";

export const DashboardPage: React.FC = () => {
  const { projects, loading, createProject } = useProjects();
  const navigate = useNavigate();
  useDashboardDocumentTitle();

  const {
    filter,
    setFilter,
    filteredProjects,
  } = useDashboardExplorerFilter({ projects });
  const { attentionProjects, nextMoveProject } = useDashboardAttention({
    projects,
    filteredProjects,
  });
  const { activity, visibleActivity, loadMore } = useDashboardActivityFeed({ projects });

  const {
    showCreate,
    name,
    desc,
    setName,
    setDesc,
    toggleCreate,
    handleCreate,
    handleCancelCreate,
  } = useDashboardCreateForm({
    onCreateProject: async (projectName, projectDescription) => {
      const project = await createProject(projectName, projectDescription);
      navigate(`/projects/${project.id}/overview`);
    },
  });

  return (
    <div className="dashboard">
      <div className="dashboard-body">
        <ProjectExplorer
          projects={filteredProjects}
          totalProjects={projects.length}
          loading={loading}
          filter={filter}
          showCreate={showCreate}
          createName={name}
          createDescription={desc}
          onFilterChange={setFilter}
          onToggleCreate={toggleCreate}
          onCreateNameChange={setName}
          onCreateDescriptionChange={setDesc}
          onCreate={handleCreate}
          onCancelCreate={handleCancelCreate}
        />

        <main className="dashboard-main">
          <div className="dashboard-main__lane">
            <NeedsAttentionSection
              projects={attentionProjects}
              nextMoveProject={nextMoveProject}
            />
            <RecentActivitySection
              activity={activity}
              visibleActivity={visibleActivity}
              onLoadMore={loadMore}
            />
          </div>
        </main>
      </div>
    </div>
  );
};
