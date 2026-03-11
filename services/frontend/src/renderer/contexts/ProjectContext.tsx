import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Project } from "@smartcar/shared";
import * as api from "../api/client";

interface ProjectContextValue {
  projects: Project[];
  loading: boolean;
  refreshProjects: () => Promise<void>;
  createProject: (name: string, description: string) => Promise<Project>;
  getProject: (id: string) => Project | null;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    try {
      const data = await api.fetchProjects();
      setProjects(data);
    } catch (e) {
      console.error("Failed to fetch projects:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const createProject = useCallback(async (name: string, description: string) => {
    const p = await api.createProject({ name, description });
    setProjects((prev) => [...prev, p]);
    return p;
  }, []);

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id) ?? null,
    [projects],
  );

  return (
    <ProjectContext.Provider value={{ projects, loading, refreshProjects, createProject, getProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectProvider");
  return ctx;
}
