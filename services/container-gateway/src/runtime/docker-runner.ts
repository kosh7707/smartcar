import { execFile } from "child_process";
import { promisify } from "util";
import type { ManagedContainerStatus } from "../contracts/container-contract";

const execFileAsync = promisify(execFile);

export interface DockerContainerInspection {
  id: string;
  name: string;
  image: string;
  status: ManagedContainerStatus;
  labels: Record<string, string>;
}

export interface DockerCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DockerRunner {
  inspectContainer(containerName: string): Promise<DockerContainerInspection | null>;
  runContainer(args: { containerName: string; image: string; labels: Record<string, string>; workspaceDir: string }): Promise<DockerContainerInspection>;
  startContainer(containerName: string): Promise<DockerContainerInspection>;
  stopContainer(containerName: string): Promise<void>;
  removeContainer(containerName: string): Promise<void>;
  execInContainer(containerName: string, command: string[], opts?: { cwd?: string; timeoutMs?: number }): Promise<DockerCommandResult>;
  copyToContainer(containerName: string, sourcePath: string, targetPath: string): Promise<void>;
}

export class ShellDockerRunner implements DockerRunner {
  async inspectContainer(containerName: string): Promise<DockerContainerInspection | null> {
    try {
      const { stdout } = await execFileAsync("docker", ["inspect", containerName]);
      const item = JSON.parse(stdout)?.[0];
      if (!item) return null;
      return {
        id: item.Id,
        name: String(item.Name ?? "").replace(/^\//, ""),
        image: item.Config?.Image ?? "",
        status: normalizeDockerStatus(item.State?.Status),
        labels: item.Config?.Labels ?? {},
      };
    } catch (error: any) {
      const text = [error?.stderr, error?.stdout, error?.message].filter(Boolean).join("\n");
      if (/No such object/i.test(text)) return null;
      throw error;
    }
  }

  async runContainer(args: { containerName: string; image: string; labels: Record<string, string>; workspaceDir: string }): Promise<DockerContainerInspection> {
    const dockerArgs = ["run", "-d", "--name", args.containerName, "-w", args.workspaceDir];
    for (const [k, v] of Object.entries(args.labels)) dockerArgs.push("--label", `${k}=${v}`);
    dockerArgs.push(args.image, "tail", "-f", "/dev/null");
    await execFileAsync("docker", dockerArgs);
    const inspected = await this.inspectContainer(args.containerName);
    if (!inspected) throw new Error(`container ${args.containerName} missing after create`);
    return inspected;
  }

  async startContainer(containerName: string): Promise<DockerContainerInspection> {
    await execFileAsync("docker", ["start", containerName]);
    const inspected = await this.inspectContainer(containerName);
    if (!inspected) throw new Error(`container ${containerName} missing after start`);
    return inspected;
  }

  async stopContainer(containerName: string): Promise<void> {
    try { await execFileAsync("docker", ["stop", containerName]); } catch {}
  }

  async removeContainer(containerName: string): Promise<void> {
    try { await execFileAsync("docker", ["rm", "-f", containerName]); } catch {}
  }

  async execInContainer(containerName: string, command: string[], opts?: { cwd?: string; timeoutMs?: number }): Promise<DockerCommandResult> {
    const args = ["exec"];
    if (opts?.cwd) args.push("-w", opts.cwd);
    args.push(containerName, ...command);
    try {
      const { stdout, stderr } = await execFileAsync("docker", args, {
        timeout: opts?.timeoutMs,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: any) {
      return { stdout: error?.stdout ?? "", stderr: error?.stderr ?? error?.message ?? "", exitCode: typeof error?.code === 'number' ? error.code : 1 };
    }
  }

  async copyToContainer(containerName: string, sourcePath: string, targetPath: string): Promise<void> {
    await execFileAsync("docker", ["cp", sourcePath, `${containerName}:${targetPath}`]);
  }
}

function normalizeDockerStatus(status?: string): ManagedContainerStatus {
  switch (status) {
    case "created": return "creating";
    case "running": return "running";
    case "exited": return "exited";
    default: return status ? "error" : "not_found";
  }
}
