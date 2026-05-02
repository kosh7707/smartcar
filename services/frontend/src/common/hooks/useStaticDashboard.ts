import { useState, useEffect, useCallback, useRef } from "react";
import type { AnalysisResult, AnalysisProgress, Run, RunDetailResponse, StaticAnalysisDashboardSummary } from "@aegis/shared";
import type { DashboardPeriod } from "@/common/ui/primitives/PeriodSelector";
import {
  fetchStaticDashboardSummary,
  fetchProjectRuns,
  fetchAllAnalysisStatuses,
  fetchRunDetail,
  logError,
} from "@/common/api/client";
import { fetchAnalysisResults } from "@/common/api/analysis";
import { POLL_ACTIVE_ANALYSIS_MS } from "@/common/constants/defaults";

export function useStaticDashboard(projectId?: string) {
  const [summary, setSummary] = useState<StaticAnalysisDashboardSummary | null>(null);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisProgress | null>(null);
  const [latestRunDetail, setLatestRunDetail] = useState<RunDetailResponse["data"] | null>(null);
  const [latestRunLoading, setLatestRunLoading] = useState(true);
  const [latestAnalysisResult, setLatestAnalysisResult] = useState<AnalysisResult | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("30d");
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const periodRef = useRef(period);
  periodRef.current = period;

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
          .filter((r) => r.module === "static_analysis" || r.module === "deep_analysis")
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

          // Fetch AnalysisResult for outcome chips + recoveryTrace (Deep runs only need it,
          // but result fields are absent on static rows so it is safe to fetch unconditionally).
          if (latestCompleted.analysisResultId) {
            fetchAnalysisResults(latestCompleted.analysisResultId)
              .then(setLatestAnalysisResult)
              .catch((e) => {
                logError("Latest analysis result", e);
                setLatestAnalysisResult(null);
              });
          } else {
            setLatestAnalysisResult(null);
          }
        } else {
          setLatestRunDetail(null);
          setLatestRunLoading(false);
          setLatestAnalysisResult(null);
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
        loadData(periodRef.current);
      }
    }, POLL_ACTIVE_ANALYSIS_MS);
  }, [checkActive, loadData]);

  // Initial load + active check
  useEffect(() => {
    setLoading(true);
    checkActive().then((running) => {
      if (running) startPolling();
    });

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [projectId, checkActive, startPolling]);

  // Period change (also handles initial load)
  useEffect(() => {
    loadData(period);
  }, [period, loadData]);

  const refresh = useCallback(() => {
    setLoading(true);
    loadData(periodRef.current);
    checkActive().then((running) => {
      if (running) startPolling();
    });
  }, [loadData, checkActive, startPolling]);

  return {
    summary,
    recentRuns,
    activeAnalysis,
    latestRunDetail,
    latestRunLoading,
    latestAnalysisResult,
    period,
    loading,
    setPeriod,
    refresh,
    startPolling,
  };
}
