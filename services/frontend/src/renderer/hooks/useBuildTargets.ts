import { useState, useEffect, useCallback } from "react";
import type { BuildTarget, BuildProfile } from "@aegis/shared";
import {
  fetchBuildTargets,
  createBuildTarget,
  updateBuildTarget,
  deleteBuildTarget,
  discoverBuildTargets,
  logError,
} from "../api/client";

export function useBuildTargets(projectId?: string) {
  const [targets, setTargets] = useState<BuildTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await fetchBuildTargets(projectId);
      setTargets(data);
    } catch (e) {
      logError("Load build targets", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (
    name: string,
    relativePath: string,
    buildProfile?: BuildProfile,
    includedPaths?: string[],
  ) => {
    if (!projectId) return;
    const created = await createBuildTarget(projectId, { name, relativePath, buildProfile, includedPaths });
    setTargets((prev) => [...prev, created]);
    return created;
  }, [projectId]);

  const update = useCallback(async (
    targetId: string,
    body: { name?: string; buildProfile?: BuildProfile; includedPaths?: string[] },
  ) => {
    if (!projectId) return;
    const updated = await updateBuildTarget(projectId, targetId, body);
    setTargets((prev) => prev.map((t) => (t.id === targetId ? updated : t)));
    return updated;
  }, [projectId]);

  const remove = useCallback(async (targetId: string) => {
    if (!projectId) return;
    await deleteBuildTarget(projectId, targetId);
    setTargets((prev) => prev.filter((t) => t.id !== targetId));
  }, [projectId]);

  const discover = useCallback(async () => {
    if (!projectId) return [];
    setDiscovering(true);
    try {
      const discovered = await discoverBuildTargets(projectId) ?? [];
      setTargets(discovered);
      return discovered;
    } catch (e) {
      logError("Discover targets", e);
      throw e;
    } finally {
      setDiscovering(false);
    }
  }, [projectId]);

  return { targets, loading, discovering, load, add, update, remove, discover };
}
