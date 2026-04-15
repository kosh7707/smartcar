import express from 'express';
import { createServer, type Server } from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceVersionStore } from '../../services/workspace-version-store';
import { ProjectSourceStore } from '../../services/project-source-store';
import { WorkspaceMaterializer } from '../../services/workspace-materializer';
import { ProjectContainerStore } from '../../services/project-container-store';
import { ProjectContainerManager } from '../../services/project-container-manager';
import { ContainerCompiler } from '../../services/container-compiler';
import { ContainerExecutor } from '../../services/container-executor';
import { FakeDockerRunner } from '../../test/fake-docker-runner';
import { createUploadRouter } from '../../routes/upload-router';
import { createCompileRouter } from '../../routes/compile-router';
import { createContainerRouter } from '../../routes/container-router';
import { createRuntimeRouter } from '../../routes/runtime-router';
import { createExecRouter } from '../../routes/exec-router';

vi.mock('../../logger', () => ({ default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

describe('upload -> compile -> teardown integration', () => {
  let server: Server; let dir: string;
  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-int-'));
    const versions = new WorkspaceVersionStore(path.join(dir, 'versions.json'));
    const sources = new ProjectSourceStore(path.join(dir, 'uploads'), versions);
    const materializer = new WorkspaceMaterializer(sources);
    const runner = new FakeDockerRunner();
    const manager = new ProjectContainerManager(new ProjectContainerStore(path.join(dir, 'containers.json')), runner, 'img', '/workspace');
    const compiler = new ContainerCompiler(manager, sources, runner, '/workspace');
    const executor = new ContainerExecutor(manager, sources, runner, '/workspace');
    const app = express();
    app.use(express.json());
    app.use('/api/projects/:projectId', createUploadRouter(materializer));
    app.use('/api/projects/:projectId/container', createContainerRouter(manager));
    app.use('/api/projects/:projectId', createCompileRouter(compiler));
    app.use('/api/projects/:projectId', createExecRouter(executor));
    app.use('/api/projects/:projectId', createRuntimeRouter(manager, sources, versions));
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });
  afterEach(async () => { await new Promise<void>((resolve)=>server.close(()=>resolve())); fs.rmSync(dir, { recursive:true, force:true }); });
  it('uploads files, compiles specific workspace, reuses container, and tears down safely', async () => {
    const http = request(server);
    const upload = await http.post('/api/projects/projA/upload').attach('file', Buffer.from('int main(){return 0;}'), 'src/main.c');
    expect(upload.status).toBe(201);
    const workspaceId = upload.body.data.workspaceId;
    const compile1 = await http.post('/api/projects/projA/compile').send({ workspaceId, profile: { language:'c', entryFile:'src/main.c', outputName:'main' } });
    expect(compile1.status).toBe(200);
    const compile2 = await http.post('/api/projects/projA/compile').send({ workspaceId, profile: { language:'c', entryFile:'src/main.c', outputName:'main2' } });
    expect(compile2.body.data.containerId).toBe(compile1.body.data.containerId);
    const status = await http.get('/api/projects/projA/container');
    expect(status.body.data.status).toBe('running');
    const exec = await http.post('/api/projects/projA/exec').send({ workspaceId, command: 'ls', args: ['-al'] });
    expect(exec.status).toBe(200);
    expect(exec.body.data.command).toBe('ls');
    const allowed = await http.get('/api/projects/projA/exec/allowed-commands');
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.commands).toContain('ls');
    const teardown = await http.delete('/api/projects/projA/runtime');
    expect(teardown.status).toBe(200);
  });

  it('rejects path-traversal project ids at the route boundary', async () => {
    const http = request(server);
    const res = await http
      .post('/api/projects/..-escape/upload')
      .attach('file', Buffer.from('int main(){return 0;}'), 'src/main.c');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects disallowed commands with a structured 400 response', async () => {
    const http = request(server);
    const upload = await http.post('/api/projects/projA/upload').attach('file', Buffer.from('int main(){return 0;}'), 'src/main.c');
    const workspaceId = upload.body.data.workspaceId;
    const exec = await http.post('/api/projects/projA/exec').send({ workspaceId, command: 'bash' });
    expect(exec.status).toBe(400);
    expect(exec.body.errorDetail.code).toBe('COMMAND_NOT_ALLOWED');
  });
});
