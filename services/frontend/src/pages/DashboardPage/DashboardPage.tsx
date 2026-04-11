import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "../../contexts/ProjectContext";
import { NeedsAttentionSection } from "./components/NeedsAttentionSection";
import { ProjectExplorer } from "./components/ProjectExplorer";
import { RecentActivitySection } from "./components/RecentActivitySection";
import { buildActivity } from "./dashboardActivity";
import { selectAttentionProjects, selectNextMoveProject } from "./dashboardProjectSignals";
import { useDashboardCreateForm } from "./useDashboardCreateForm";
import "./DashboardPage.css";

export const DashboardPage: React.FC = () => {
  const { projects, loading, createProject } = useProjects();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [visibleActivityCount, setVisibleActivityCount] = useState(10);

  useEffect(() => {
    document.title = "AEGIS — Dashboard";
  }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return projects;
    const query = filter.toLowerCase();
    return projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(query));
  }, [projects, filter]);

  const attentionProjects = useMemo(() => selectAttentionProjects(projects), [projects]);
  const nextMoveProject = useMemo(
    () => selectNextMoveProject(attentionProjects, filtered, projects),
    [attentionProjects, filtered, projects],
  );
  const activity = useMemo(() => buildActivity(projects), [projects]);
  const visibleActivity = useMemo(() => activity.slice(0, visibleActivityCount), [activity, visibleActivityCount]);

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
          projects={filtered}
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
              onLoadMore={() => setVisibleActivityCount((count) => count + 10)}
            />
          </div>
        </main>
      </div>
    </div>
  );
};
