import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "../../contexts/ProjectContext";
import { NeedsAttentionSection } from "./components/NeedsAttentionSection";
import { ProjectExplorer } from "./components/ProjectExplorer";
import { RecentActivitySection } from "./components/RecentActivitySection";
import { buildActivity } from "./dashboardActivity";
import { projectPriority } from "./dashboardProjectSignals";
import "./DashboardPage.css";

export const DashboardPage: React.FC = () => {
  const { projects, loading, createProject } = useProjects();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [visibleActivityCount, setVisibleActivityCount] = useState(10);

  useEffect(() => {
    document.title = "AEGIS — Dashboard";
  }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return projects;
    const query = filter.toLowerCase();
    return projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(query));
  }, [projects, filter]);

  const attentionProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => projectPriority(b) - projectPriority(a))
      .filter((project) => projectPriority(project) > 0)
      .slice(0, 4);
  }, [projects]);

  const nextMoveProject = attentionProjects[0] ?? filtered[0] ?? projects[0] ?? null;
  const activity = useMemo(() => buildActivity(projects), [projects]);
  const visibleActivity = useMemo(() => activity.slice(0, visibleActivityCount), [activity, visibleActivityCount]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const project = await createProject(name.trim(), desc.trim());
    setName("");
    setDesc("");
    setShowCreate(false);
    navigate(`/projects/${project.id}/overview`);
  };

  const handleCancelCreate = () => {
    setShowCreate(false);
    setName("");
    setDesc("");
  };

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
          onToggleCreate={() => setShowCreate((prev) => !prev)}
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
