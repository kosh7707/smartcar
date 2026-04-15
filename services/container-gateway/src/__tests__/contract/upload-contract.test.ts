import { describe, expect, it } from 'vitest';
import type { UploadWorkspaceSummary } from '../../contracts/upload-contract';

describe('upload contract', () => {
  it('includes S8-owned upload and workspace identifiers', () => {
    const sample: UploadWorkspaceSummary = {
      projectId: 'projA',
      uploadId: 'upload-1',
      workspaceId: 'projA-ws-v1',
      workspaceVersion: 1,
      workspacePath: '/tmp/uploads/projA/projA-ws-v1',
      fileCount: 1,
      files: [{ relativePath: 'src/main.c', size: 12 }],
    };
    expect(sample.uploadId).toContain('upload-');
    expect(sample.workspaceId).toContain('ws');
  });
});
