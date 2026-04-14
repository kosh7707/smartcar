import path from "path";
import type { DockerCommandResult, DockerContainerInspection, DockerRunner } from "../runtime/docker-runner";

interface FakeContainer { id: string; name: string; image: string; status: "running" | "exited"; labels: Record<string,string>; files: string[]; }

export class FakeDockerRunner implements DockerRunner {
  private readonly containers = new Map<string, FakeContainer>();
  private nextId = 1;
  async inspectContainer(containerName: string): Promise<DockerContainerInspection | null> {
    const item = this.containers.get(containerName); if (!item) return null;
    return { id: item.id, name: item.name, image: item.image, status: item.status, labels: item.labels };
  }
  async runContainer(args: { containerName: string; image: string; labels: Record<string,string>; workspaceDir: string }): Promise<DockerContainerInspection> {
    this.containers.set(args.containerName, { id: `fake-${this.nextId++}`, name: args.containerName, image: args.image, status: 'running', labels: args.labels, files: [] });
    return this.inspectContainer(args.containerName) as Promise<DockerContainerInspection>;
  }
  async startContainer(containerName: string): Promise<DockerContainerInspection> { const item=this.containers.get(containerName); if(!item) throw new Error(`Missing ${containerName}`); item.status='running'; return this.inspectContainer(containerName) as Promise<DockerContainerInspection>; }
  async stopContainer(containerName: string): Promise<void> { const item=this.containers.get(containerName); if(item) item.status='exited'; }
  async removeContainer(containerName: string): Promise<void> { this.containers.delete(containerName); }
  async execInContainer(containerName: string, command: string[]): Promise<DockerCommandResult> {
    const item=this.containers.get(containerName); if(!item) return { stdout:'', stderr:`missing container ${containerName}`, exitCode:1 };
    const joined=command.join(' ');
    if (joined.includes('mkdir -p')) return { stdout:'', stderr:'', exitCode:0 };
    if (joined.includes('gcc') || joined.includes('g++') || joined.includes('arm-linux-gnueabihf-gcc') || joined.includes('aarch64-linux-gnu-gcc')) {
      const match=joined.match(/-o\s+([^\s]+)/); if(match) item.files.push(match[1].replace(/^'+|'+$/g,''));
      return { stdout:'compiled\n', stderr:'', exitCode:0 };
    }
    if (command[0] === 'cp' || command[0] === 'mv' || command[0] === 'mkdir') {
      return { stdout: '', stderr: '', exitCode: 0 };
    }
    if (command[0] === 'ls') {
      return { stdout: item.files.join('\n'), stderr: '', exitCode: 0 };
    }
    if (command[0] === 'pwd') {
      return { stdout: '/workspace\n', stderr: '', exitCode: 0 };
    }
    return { stdout:'', stderr:'', exitCode:0 };
  }
  async copyToContainer(containerName: string, sourcePath: string, targetPath: string): Promise<void> {
    const item=this.containers.get(containerName); if(!item) throw new Error(`Missing ${containerName}`);
    item.files.push(path.posix.join(targetPath, path.basename(sourcePath)));
  }
  forceExit(containerName: string): void { const item=this.containers.get(containerName); if(item) item.status='exited'; }
}
