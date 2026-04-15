import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectContainerStore } from '../../services/project-container-store';
import { ProjectContainerManager } from '../../services/project-container-manager';
import { FakeDockerRunner } from '../../test/fake-docker-runner';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe('project container manager', () => {
  it('creates and reuses per project', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-manager-')); dirs.push(dir);
    const store = new ProjectContainerStore(path.join(dir, 'containers.json'));
    const runner = new FakeDockerRunner();
    const manager = new ProjectContainerManager(store, runner, 'img', '/workspace');
    const one = await manager.ensureContainer('projA');
    const two = await manager.ensureContainer('projA');
    expect(one.reused).toBe(false);
    expect(two.reused).toBe(true);
    expect(two.containerId).toBe(one.containerId);
  });
});
