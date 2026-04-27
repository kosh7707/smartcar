import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectOverviewResponse, UploadedFile } from "@aegis/shared";
import { fetchProjectFiles, fetchProjectOverview, logError } from "../../../api/client";
import { fetchApprovalCount } from "../../../api/approval";
import { fetchProjectGates } from "../../../api/gate";
import type { GateResult } from "../../../api/gate";
import { fetchProjectActivity } from "../../../api/projects";
import type { ActivityEntry } from "../../../api/projects";
import { fetchProjectSdks } from "../../../api/sdk";
import type { RegisteredSdk } from "../../../api/sdk";
import { getGateCounts, getTopVulnerabilities, getTotalFindings, isOverviewEmpty } from "../overviewModel";

type ToastApi = {
  error: (message: string) => void;
};

export function useOverviewPage(projectId: string | undefined, toast: ToastApi) {
  const [overview, setOverview] = useState<ProjectOverviewResponse | null>(null);
  const [projectFiles, setProjectFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeredSdks, setRegisteredSdks] = useState<RegisteredSdk[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [gates, setGates] = useState<GateResult[]>([]);
  const [approvalCount, setApprovalCount] = useState<{ pending: number; total: number }>({ pending: 0, total: 0 });

  useEffect(() => {
    document.title = "AEGIS — Overview";
  }, []);

  useEffect(() => {
    if (!projectId) {
      setOverview(null);
      setProjectFiles([]);
      setRegisteredSdks([]);
      setActivities([]);
      setGates([]);
      setApprovalCount({ pending: 0, total: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      fetchProjectOverview(projectId),
      fetchProjectFiles(projectId).catch(() => [] as UploadedFile[]),
    ])
      .then(([nextOverview, files]) => {
        setOverview(nextOverview);
        setProjectFiles(files);
      })
      .catch((error) => {
        logError("Fetch overview", error);
        toast.error("프로젝트 개요를 불러올 수 없습니다.");
      })
      .finally(() => setLoading(false));

    fetchProjectSdks(projectId)
      .then((data) => setRegisteredSdks(data.registered))
      .catch(() => setRegisteredSdks([]));

    fetchProjectActivity(projectId, 8)
      .then(setActivities)
      .catch(() => setActivities([]));

    fetchProjectGates(projectId)
      .then(setGates)
      .catch(() => setGates([]));

    fetchApprovalCount(projectId)
      .then(setApprovalCount)
      .catch(() => setApprovalCount({ pending: 0, total: 0 }));
  }, [projectId, toast]);

  const recentAnalyses = overview?.recentAnalyses ?? [];
  const latestDeepResult = useMemo(
    () => recentAnalyses.find((a) => a.module === "deep_analysis") ?? null,
    [recentAnalyses],
  );
  const topVulnerabilities = useMemo(() => getTopVulnerabilities(recentAnalyses, 8), [recentAnalyses]);
  const gateCounts = useMemo(() => getGateCounts(gates), [gates]);
  const totalFileSize = useMemo(
    () => projectFiles.reduce((size, file) => size + (file.size || 0), 0),
    [projectFiles],
  );

  const severitySummary = overview?.summary?.bySeverity ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const totalFindings = useMemo(() => getTotalFindings(severitySummary), [severitySummary]);
  const empty = useMemo(() => isOverviewEmpty(recentAnalyses, projectFiles), [projectFiles, recentAnalyses]);

  const openProjectPath = useCallback((navigate: (to: string) => void, path: string) => {
    if (!projectId) return;
    navigate(`/projects/${projectId}/${path}`);
  }, [projectId]);

  return {
    overview,
    projectFiles,
    loading,
    registeredSdks,
    activities,
    gates,
    approvalCount,
    recentAnalyses,
    topVulnerabilities,
    gateCounts,
    totalFileSize,
    severitySummary,
    totalFindings,
    empty,
    latestDeepResult,
    openProjectPath,
  };
}
