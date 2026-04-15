import type { EnsureProjectContainerResponse, ManagedContainerStatus, ProjectContainerRecord } from "../contracts/container-contract";
import type { DockerRunner, DockerContainerInspection } from "../runtime/docker-runner";
import { ProjectContainerStore } from "./project-container-store";
import logger from "../logger";
import { assertProjectId } from "../utils/project-id";

export class ProjectContainerManager {
  constructor(private readonly store: ProjectContainerStore, private readonly runner: DockerRunner, private readonly defaultImage: string, private readonly workspaceDir: string) {}

  getContainerName(projectId: string): string {
    assertProjectId(projectId);
    return `aegis-s8-project-${sanitize(projectId)}`;
  }

  async ensureContainer(projectId: string, imageOverride?: string): Promise<EnsureProjectContainerResponse> {
    assertProjectId(projectId);
    const image = imageOverride ?? this.defaultImage;
    const containerName = this.getContainerName(projectId);
    const labels = { "aegis.managed": "true", "aegis.scope": "container-gateway", "aegis.projectId": projectId };
    const existing = await this.runner.inspectContainer(containerName);
    const now = new Date().toISOString();
    let inspection: DockerContainerInspection;
    let reused = true;
    let createdAt = this.store.find(projectId)?.createdAt ?? now;
    if (!existing) {
      reused = false;
      inspection = await this.runner.runContainer({ containerName, image, labels, workspaceDir: this.workspaceDir });
      createdAt = now;
      logger.info({ projectId, containerName, containerId: inspection.id }, "Project container created");
    } else if (existing.status === "exited") {
      inspection = await this.runner.startContainer(containerName);
      logger.info({ projectId, containerName, containerId: inspection.id }, "Project container restarted");
    } else {
      inspection = existing;
      logger.info({ projectId, containerName, containerId: inspection.id }, "Project container reused");
    }
    const record: ProjectContainerRecord = { projectId, containerName, containerId: inspection.id, image: inspection.image || image, status: inspection.status, createdAt, updatedAt: now, labels };
    this.store.save(record);
    return { ...record, reused };
  }

  async getContainerStatus(projectId: string): Promise<ProjectContainerRecord> {
    assertProjectId(projectId);
    const name = this.getContainerName(projectId);
    const stored = this.store.find(projectId);
    const inspected = await this.runner.inspectContainer(name);
    if (!inspected) {
      return { projectId, containerName: name, containerId: stored?.containerId, image: stored?.image ?? this.defaultImage, status: "not_found", createdAt: stored?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(), labels: stored?.labels ?? { "aegis.managed": "true", "aegis.scope": "container-gateway", "aegis.projectId": projectId }, lastError: stored?.lastError };
    }
    const now = new Date().toISOString();
    const record: ProjectContainerRecord = { projectId, containerName: name, containerId: inspected.id, image: inspected.image, status: inspected.status, createdAt: stored?.createdAt ?? now, updatedAt: now, labels: inspected.labels, lastError: stored?.lastError };
    this.store.save(record);
    return record;
  }

  async teardownProject(projectId: string): Promise<void> {
    assertProjectId(projectId);
    const name = this.getContainerName(projectId);
    await this.runner.stopContainer(name);
    await this.runner.removeContainer(name);
    this.store.remove(projectId);
  }
}

function sanitize(value: string): string { return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "project"; }
