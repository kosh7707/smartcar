import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectContainerStore } from '../../services/project-container-store';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe('project container store', () => {
  it('persists project container mappings', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-container-store-')); dirs.push(dir);
    const store = new ProjectContainerStore(path.join(dir, 'containers.json'));
    store.save({ projectId:'projA', containerName:'a', containerId:'cid', image:'img', status:'running', createdAt:'x', updatedAt:'x', labels:{} });
    expect(new ProjectContainerStore(path.join(dir, 'containers.json')).find('projA')?.containerId).toBe('cid');
  });
});
