import path from "path";
import type { CompileRequest, CompileResponse, CompileProfile } from "../contracts/compile-contract";
import type { DockerRunner } from "../runtime/docker-runner";
import { ProjectContainerManager } from "./project-container-manager";
import { ProjectSourceStore } from "./project-source-store";
import logger from "../logger";
import { shellQuote } from "../utils/shell-quote";
import { canonicalizeProjectId } from "../utils/project-id";

export class ContainerCompiler {
  constructor(private readonly manager: ProjectContainerManager, private readonly sources: ProjectSourceStore, private readonly runner: DockerRunner, private readonly workspaceDir: string) {}

  async compile(projectId: string, request: CompileRequest): Promise<CompileResponse> {
    projectId = canonicalizeProjectId(projectId);
    const workspace = this.sources.getWorkspace(projectId, request.workspaceId);
    const ensured = await this.manager.ensureContainer(projectId);
    const jobId = new Date().toISOString().replace(/[:.]/g, '-');
    const containerWorkspace = path.posix.join(this.workspaceDir, 'jobs', jobId, 'workspace');
    const outputDir = path.posix.join(this.workspaceDir, 'jobs', jobId, 'out');
    await this.runner.execInContainer(ensured.containerName, ['sh', '-lc', `mkdir -p ${shellQuote(containerWorkspace)} ${shellQuote(outputDir)}`]);
    await this.runner.copyToContainer(ensured.containerName, `${path.resolve(workspace.workspacePath)}/.`, containerWorkspace);
    const cmd = renderCompileCommand(request.profile, containerWorkspace, outputDir);
    const result = await this.runner.execInContainer(ensured.containerName, ['sh', '-lc', cmd], { cwd: containerWorkspace });
    const artifactPath = path.posix.join(outputDir, request.profile.outputName);
    logger.info({ projectId, uploadId: workspace.uploadId, workspaceId: workspace.workspaceId, workspaceVersion: workspace.workspaceVersion, containerName: ensured.containerName, containerId: ensured.containerId, exitCode: result.exitCode, artifactPaths: [artifactPath] }, 'Compile request completed');
    return { projectId, uploadId: workspace.uploadId, workspaceId: workspace.workspaceId, workspaceVersion: workspace.workspaceVersion, containerName: ensured.containerName, containerId: ensured.containerId, success: result.exitCode === 0, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, artifactPaths: [artifactPath], reused: ensured.reused };
  }
}

export function renderCompileCommand(profile: CompileProfile, workspaceDir: string, outputDir: string): string {
  const compiler = profile.compiler ?? (profile.language === 'cpp' ? 'g++' : 'gcc');
  const includes = (profile.includePaths ?? []).map((entry) => `-I${shellQuote(path.posix.join(workspaceDir, entry))}`);
  const entryFile = path.posix.join(workspaceDir, profile.entryFile);
  const outputFile = path.posix.join(outputDir, profile.outputName);
  return [compiler, ...(profile.flags ?? []), ...includes, shellQuote(entryFile), '-o', shellQuote(outputFile)].join(' ');
}
