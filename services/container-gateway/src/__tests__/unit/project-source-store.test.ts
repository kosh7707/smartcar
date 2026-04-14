import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceVersionStore } from '../../services/workspace-version-store';
import { ProjectSourceStore } from '../../services/project-source-store';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe('project source store', () => {
  it('creates versioned workspaces for repeated uploads', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-source-')); dirs.push(dir);
    const versions = new WorkspaceVersionStore(path.join(dir, 'versions.json'));
    const store = new ProjectSourceStore(path.join(dir, 'uploads'), versions);
    const one = store.createWorkspace('projA', [{ relativePath: 'src/main.c', buffer: Buffer.from('int main(){}') }]);
    const two = store.createWorkspace('projA', [{ relativePath: 'src/main.c', buffer: Buffer.from('int main(){return 0;}') }]);
    expect(one.workspaceId).not.toBe(two.workspaceId);
    expect(two.workspaceVersion).toBe(2);
  });

  it('rejects invalid project ids before touching the filesystem', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's8-source-')); dirs.push(dir);
    const versions = new WorkspaceVersionStore(path.join(dir, 'versions.json'));
    const store = new ProjectSourceStore(path.join(dir, 'uploads'), versions);
    expect(() =>
      store.createWorkspace('../escape', [{ relativePath: 'src/main.c', buffer: Buffer.from('int main(){}') }])
    ).toThrow('Invalid projectId');
  });
});
