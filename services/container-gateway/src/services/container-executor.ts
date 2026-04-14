import path from "path";
import logger from "../logger";
import type { ExecRequest, ExecResponse } from "../contracts/exec-contract";
import type { DockerRunner } from "../runtime/docker-runner";
import { assertProjectId } from "../utils/project-id";
import { ProjectContainerManager } from "./project-container-manager";
import { ProjectSourceStore } from "./project-source-store";
import { ensureAllowedCommand, ensureSafeExecArgs } from "./exec-policy";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 60_000;

export class ContainerExecutor {
  constructor(
    private readonly manager: ProjectContainerManager,
    private readonly sources: ProjectSourceStore,
    private readonly runner: DockerRunner,
    private readonly workspaceDir: string
  ) {}

  async execute(projectId: string, request: ExecRequest): Promise<ExecResponse> {
    assertProjectId(projectId);
    if (!request.command?.trim()) {
      throw new Error("command is required");
    }
    ensureAllowedCommand(request.command);
    ensureSafeExecArgs(request.command, request.args ?? []);

    const workspace = this.sources.getWorkspace(projectId, request.workspaceId);
    const ensured = await this.manager.ensureContainer(projectId);
    const containerWorkspace = path.posix.join(
      this.workspaceDir,
      "projects",
      projectId,
      workspace.workspaceId
    );

    await this.runner.execInContainer(ensured.containerName, [
      "sh",
      "-lc",
      `mkdir -p '${containerWorkspace}'`,
    ]);
    await this.runner.copyToContainer(
      ensured.containerName,
      `${path.resolve(workspace.workspacePath)}/.`,
      containerWorkspace
    );

    const requestedCwd = request.cwd
      ? path.posix.normalize(path.posix.join(containerWorkspace, request.cwd))
      : containerWorkspace;
    if (!requestedCwd.startsWith(containerWorkspace)) {
      throw new Error("cwd must remain inside the uploaded workspace");
    }

    const startedAt = Date.now();
    const result = await this.runner.execInContainer(
      ensured.containerName,
      [request.command, ...(request.args ?? [])],
      { cwd: requestedCwd, timeoutMs: clampTimeout(request.timeoutMs) }
    );
    const durationMs = Date.now() - startedAt;

    logger.info(
      {
        projectId,
        uploadId: workspace.uploadId,
        workspaceId: workspace.workspaceId,
        workspaceVersion: workspace.workspaceVersion,
        containerName: ensured.containerName,
        containerId: ensured.containerId,
        command: request.command,
        args: request.args ?? [],
        cwd: requestedCwd,
        exitCode: result.exitCode,
        durationMs,
      },
      "Exec request completed"
    );

    return {
      projectId,
      uploadId: workspace.uploadId,
      workspaceId: workspace.workspaceId,
      workspaceVersion: workspace.workspaceVersion,
      containerName: ensured.containerName,
      containerId: ensured.containerId,
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      reused: ensured.reused,
      workingDirectory: requestedCwd,
      command: request.command,
      args: request.args ?? [],
      durationMs,
    };
  }
}

function clampTimeout(timeoutMs?: number): number {
  if (!timeoutMs || !Number.isFinite(timeoutMs)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(1_000, Math.min(MAX_TIMEOUT_MS, Math.floor(timeoutMs)));
}
