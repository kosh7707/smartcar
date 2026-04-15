import { describe, expect, it } from 'vitest';
import type { CompileRequest, CompileResponse } from '../../contracts/compile-contract';

describe('compile contract', () => {
  it('references workspaceId instead of raw workspacePath', () => {
    const req: CompileRequest = { workspaceId: 'projA-ws-v1', profile: { language: 'c', entryFile: 'src/main.c', outputName: 'main' } };
    expect(req.workspaceId).toContain('ws');
  });
  it('returns compile artifact metadata', () => {
    const res: CompileResponse = {
      projectId: 'projA', uploadId: 'upload-1', workspaceId: 'projA-ws-v1', workspaceVersion: 1,
      containerName: 'a', containerId: 'cid', success: true, exitCode: 0, stdout: '', stderr: '', artifactPaths: ['/workspace/out/main'], reused: true,
    };
    expect(res.artifactPaths[0]).toContain('/out/');
  });
});
