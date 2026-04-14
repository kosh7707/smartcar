import { describe, expect, it } from 'vitest';
import type { EnsureProjectContainerResponse, ProjectContainerRecord } from '../../contracts/container-contract';

describe('container contract', () => {
  it('uses project-scoped identity', () => {
    const sample: EnsureProjectContainerResponse = {
      projectId: 'projA',
      containerName: 'aegis-s8-project-proja',
      containerId: 'cid-1',
      image: 'aegis-s8-qemu-compile:latest',
      status: 'running',
      reused: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      labels: { 'aegis.projectId': 'projA' },
    };
    expect(sample.projectId).toBe('projA');
    expect(sample.labels['aegis.projectId']).toBe('projA');
  });
  it('supports teardown states', () => {
    const sample: ProjectContainerRecord = {
      projectId: 'projA', containerName: 'a', image: 'img', status: 'tearing_down', createdAt: 'x', updatedAt: 'x', labels: {}
    };
    expect(sample.status).toBe('tearing_down');
  });
});
