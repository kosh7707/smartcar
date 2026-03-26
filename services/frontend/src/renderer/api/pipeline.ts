import type {
  BuildTarget,
  BuildProfile,
} from "@aegis/shared";
import { apiFetch } from "./core";

// ── Build Targets ──

export async function fetchBuildTargets(projectId: string): Promise<BuildTarget[]> {
  const res = await apiFetch<{ success: boolean; data: BuildTarget[] }>(
    `/api/projects/${projectId}/targets`,
  );
  return res.data;
}

export async function createBuildTarget(
  projectId: string,
  body: { name: string; relativePath: string; buildProfile?: BuildProfile; includedPaths?: string[] },
): Promise<BuildTarget> {
  const res = await apiFetch<{ success: boolean; data: BuildTarget }>(
    `/api/projects/${projectId}/targets`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

export async function updateBuildTarget(
  projectId: string,
  targetId: string,
  body: { name?: string; buildProfile?: BuildProfile },
): Promise<BuildTarget> {
  const res = await apiFetch<{ success: boolean; data: BuildTarget }>(
    `/api/projects/${projectId}/targets/${targetId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

export async function deleteBuildTarget(
  projectId: string,
  targetId: string,
): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/targets/${targetId}`, { method: "DELETE" });
}

export async function discoverBuildTargets(projectId: string): Promise<BuildTarget[]> {
  const res = await apiFetch<{ success: boolean; data: BuildTarget[] }>(
    `/api/projects/${projectId}/targets/discover`,
    { method: "POST" },
  );
  return res.data;
}

// ── Target Libraries (third-party) ──

export interface TargetLibrary {
  id: string;
  targetId: string;
  projectId: string;
  name: string;
  version?: string;
  path: string;
  included: boolean;
  modifiedFiles: string[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchTargetLibraries(
  projectId: string,
  targetId: string,
): Promise<TargetLibrary[]> {
  const res = await apiFetch<{ success: boolean; data: TargetLibrary[] }>(
    `/api/projects/${projectId}/targets/${targetId}/libraries`,
  );
  return res.data;
}

export async function updateTargetLibraries(
  projectId: string,
  targetId: string,
  libraries: Array<{ id: string; included: boolean }>,
): Promise<void> {
  await apiFetch(
    `/api/projects/${projectId}/targets/${targetId}/libraries`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libraries }),
    },
  );
}

// ── Pipeline ──

export async function runPipeline(
  projectId: string,
  targetIds?: string[],
): Promise<{ pipelineId: string; status: string }> {
  const body: Record<string, unknown> = {};
  if (targetIds && targetIds.length > 0) body.targetIds = targetIds;
  const res = await apiFetch<{ success: boolean; data: { pipelineId: string; status: string } }>(
    `/api/projects/${projectId}/pipeline/run`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  return res.data;
}

export async function runPipelineTarget(
  projectId: string,
  targetId: string,
): Promise<{ pipelineId: string }> {
  const res = await apiFetch<{ success: boolean; data: { pipelineId: string } }>(
    `/api/projects/${projectId}/pipeline/run/${targetId}`,
    { method: "POST" },
  );
  return res.data;
}

export interface PipelineStatusResponse {
  targets: Array<{ id: string; name: string; status: string; phase: string; message: string }>;
  readyCount: number;
  failedCount: number;
  totalCount: number;
}

export async function fetchPipelineStatus(projectId: string): Promise<PipelineStatusResponse> {
  const res = await apiFetch<{ success: boolean; data: PipelineStatusResponse }>(
    `/api/projects/${projectId}/pipeline/status`,
  );
  return res.data;
}
