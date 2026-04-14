export type ManagedContainerStatus = "not_found" | "creating" | "running" | "exited" | "error" | "tearing_down" | "teardown_failed" | "deleted";

export interface ProjectContainerRecord {
  projectId: string;
  containerName: string;
  containerId?: string;
  image: string;
  status: ManagedContainerStatus;
  createdAt: string;
  updatedAt: string;
  labels: Record<string, string>;
  lastError?: string;
}

export interface EnsureProjectContainerResponse {
  projectId: string;
  containerName: string;
  containerId?: string;
  image: string;
  status: ManagedContainerStatus;
  reused: boolean;
  createdAt: string;
  updatedAt: string;
  labels: Record<string, string>;
}
