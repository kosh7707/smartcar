import express from 'express';
import path from 'path';
import { config } from './config';
import logger from './logger';
import { WorkspaceVersionStore } from './services/workspace-version-store';
import { ProjectSourceStore } from './services/project-source-store';
import { WorkspaceMaterializer } from './services/workspace-materializer';
import { ProjectContainerStore } from './services/project-container-store';
import { ShellDockerRunner } from './runtime/docker-runner';
import { ProjectContainerManager } from './services/project-container-manager';
import { ContainerCompiler } from './services/container-compiler';
import { createHealthRouter } from './routes/health-router';
import { createUploadRouter } from './routes/upload-router';
import { createContainerRouter } from './routes/container-router';
import { createCompileRouter } from './routes/compile-router';
import { createRuntimeRouter } from './routes/runtime-router';
import { ContainerExecutor } from './services/container-executor';
import { createExecRouter } from './routes/exec-router';

export function createApp() {
  const app = express();
  app.use(express.json());

  const versions = new WorkspaceVersionStore(path.join(config.runtimeDir, 'workspace-versions.json'));
  const sources = new ProjectSourceStore(config.uploadsDir, versions);
  const materializer = new WorkspaceMaterializer(sources);
  const containerStore = new ProjectContainerStore(path.join(config.runtimeDir, 'project-containers.json'));
  const dockerRunner = new ShellDockerRunner();
  const manager = new ProjectContainerManager(containerStore, dockerRunner, config.defaultImage, config.workspaceMountDir);
  const compiler = new ContainerCompiler(manager, sources, dockerRunner, config.workspaceMountDir);
  const executor = new ContainerExecutor(manager, sources, dockerRunner, config.workspaceMountDir);

  app.use(createHealthRouter());
  app.use('/api/projects/:projectId', createUploadRouter(materializer));
  app.use('/api/projects/:projectId/container', createContainerRouter(manager));
  app.use('/api/projects/:projectId', createCompileRouter(compiler));
  app.use('/api/projects/:projectId', createExecRouter(executor));
  app.use('/api/projects/:projectId', createRuntimeRouter(manager, sources, versions));

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled request error');
    res.status(500).json({ success: false, error: err?.message ?? 'internal error' });
  });
  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(config.port, () => logger.info({ port: config.port }, 'S8 Container Gateway started'));
}
