import { useState, useEffect, useCallback, useRef } from "react";
import type { StaticAnalysisDashboardSummary, Run, AnalysisProgress, RunDetailResponse } from "@smartcar/shared";
import type { DashboardPeriod } from "../components/ui/PeriodSelector";
import {
  fetchStaticDashboardSummary,
  fetchProjectRuns,
  fetchAllAnalysisStatuses,
  fetchRunDetail,
  logError,
} from "../api/client";

export function useStaticDashboard(projectId?: string) {
  const [summary, setSummary] = useState<StaticAnalysisDashboardSummary | null>(null);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisProgress | null>(null);
  const [latestRunDetail, setLatestRunDetail] = useState<RunDetailResponse["data"] | null>(null);
  const [latestRunLoading, setLatestRunLoading] = useState(true);
  const [period, setPeriod] = useState<DashboardPeriod>("30d");
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(
    async (p: DashboardPeriod) => {
      if (!projectId) return;
      try {
        const [summaryData, runs] = await Promise.all([
          fetchStaticDashboardSummary(projectId, p),
          fetchProjectRuns(projectId),
        ]);
        setSummary(summaryData);
        const sorted = runs
          .filter((r) => r.module === "static_analysis")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRecentRuns(sorted);

        // Fetch latest completed run detail
        const latestCompleted = sorted.find((r) => r.status === "completed");
        if (latestCompleted) {
          setLatestRunLoading(true);
          fetchRunDetail(latestCompleted.id)
            .then(setLatestRunDetail)
            .catch((e) => logError("Latest run detail", e))
            .finally(() => setLatestRunLoading(false));
        } else {
          setLatestRunDetail(null);
          setLatestRunLoading(false);
        }
      } catch (e) {
        logError("Dashboard load", e);
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  const checkActive = useCallback(async () => {
    if (!projectId) return false;
    try {
      const statuses = await fetchAllAnalysisStatuses();
      const running = statuses.find(
        (s) => s.projectId === projectId && s.status === "running",
      );
      setActiveAnalysis(running ?? null);
      return !!running;
    } catch (e) {
      logError("Check active analysis", e);
      setActiveAnalysis(null);
      return false;
    }
  }, [projectId]);

  // Start/stop polling for active analysis
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const stillRunning = await checkActive();
      if (!stillRunning && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        // Refresh dashboard data when analysis completes
        loadData(period);
      }
    }, 3000);
  }, [checkActive, loadData, period]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadData(period);
    checkActive().then((running) => {
      if (running) startPolling();
    });

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Period change
  useEffect(() => {
    loadData(period);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setLoading(true);
    loadData(period);
    checkActive().then((running) => {
      if (running) startPolling();
    });
  }, [loadData, period, checkActive, startPolling]);

  const handleSetPeriod = useCallback((p: DashboardPeriod) => {
    setPeriod(p);
  }, []);

  return {
    summary,
    recentRuns,
    activeAnalysis,
    latestRunDetail,
    latestRunLoading,
    period,
    loading,
    setPeriod: handleSetPeriod,
    refresh,
    startPolling,
  };
}
