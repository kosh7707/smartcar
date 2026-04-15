import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceVersionStore } from '../../services/workspace-version-store';
import { ProjectSourceStore } from '../../services/project-source-store';
import { ProjectContainerStore } from '../../services/project-container-store';
import { ProjectContainerManager } from '../../services/project-container-manager';
import { ContainerCompiler, renderCompileCommand } from '../../services/container-compiler';
import { FakeDockerRunner } from '../../test/fake-docker-runner';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe('container compiler', () => {
  it('renders command with workspace-local entry and output', () => {
    const cmd = renderCompileCommand({ language:'c', entryFile:'src/main.c', outputName:'main', compiler:'arm-linux-gnueabihf-gcc', flags:['-O2'] }, '/workspace/in', '/workspace/out');
    expect(cmd).toContain('arm-linux-gnueabihf-gcc');
    expect(cmd).toContain('/workspace/in/src/main.c');
  });
  it('compiles a specific workspace version', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-compiler-')); dirs.push(dir);
    const versions = new WorkspaceVersionStore(path.join(dir, 'versions.json'));
    const sources = new ProjectSourceStore(path.join(dir, 'uploads'), versions);
    const ws = sources.createWorkspace('projA', [{ relativePath: 'src/main.c', buffer: Buffer.from('int main(){return 0;}') }]);
    const runner = new FakeDockerRunner();
    const manager = new ProjectContainerManager(new ProjectContainerStore(path.join(dir, 'containers.json')), runner, 'img', '/workspace');
    const compiler = new ContainerCompiler(manager, sources, runner, '/workspace');
    const res = await compiler.compile('projA', { workspaceId: ws.workspaceId, profile: { language:'c', entryFile:'src/main.c', outputName:'main' } });
    expect(res.success).toBe(true);
    expect(res.workspaceId).toBe(ws.workspaceId);
  });

  it('canonicalizes project ids before compiling', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-compiler-')); dirs.push(dir);
    const versions = new WorkspaceVersionStore(path.join(dir, 'versions.json'));
    const sources = new ProjectSourceStore(path.join(dir, 'uploads'), versions);
    const ws = sources.createWorkspace('ProjA', [{ relativePath: 'src/main.c', buffer: Buffer.from('int main(){return 0;}') }]);
    const runner = new FakeDockerRunner();
    const manager = new ProjectContainerManager(new ProjectContainerStore(path.join(dir, 'containers.json')), runner, 'img', '/workspace');
    const compiler = new ContainerCompiler(manager, sources, runner, '/workspace');
    const res = await compiler.compile('ProjA', { workspaceId: ws.workspaceId, profile: { language:'c', entryFile:'src/main.c', outputName:'main' } });
    expect(res.projectId).toBe('proja');
    expect(res.workspaceId).toBe('proja-ws-v1');
  });
});
