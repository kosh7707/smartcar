import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Project } from "@smartcar/shared";
import * as api from "../api/client";
import { ApiError, logError } from "../api/client";
import { useToast } from "./ToastContext";

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
  const toast = useToast();

  const refreshProjects = useCallback(async () => {
    try {
      const data = await api.fetchProjects();
      setProjects(data);
    } catch (e) {
      logError("Fetch projects", e);
      const msg = e instanceof Error ? e.message : "프로젝트 목록을 불러올 수 없습니다.";
      const retry = e instanceof ApiError && e.retryable ? { label: "다시 시도", onClick: () => refreshProjects() } : undefined;
      toast.error(msg, retry);
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
