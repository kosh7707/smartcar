import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnalysisResult, ProjectReport } from "@aegis/shared";
import type { ReportFilters } from "@/common/api/client";
import { ApiError, fetchProjectReport, logError } from "@/common/api/client";
import { fetchAnalysisResults } from "@/common/api/analysis";
import { getReportModuleEntries, type ModuleTab } from "./reportPresentation";

type ToastAction = { label: string; onClick: () => void } | undefined;

type ToastApi = {
  error: (message: string, action?: ToastAction) => void;
};

export function useReportPageController(projectId: string | undefined, toast: ToastApi) {
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<ModuleTab>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showCustomReport, setShowCustomReport] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [pendingFilters, setPendingFilters] = useState<ReportFilters>({});

  useEffect(() => {
    document.title = "AEGIS — 보고서";
  }, []);

  const loadReport = useCallback(() => {
    if (!projectId) {
      setReport(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(false);

    fetchProjectReport(projectId, filters)
      .then(setReport)
      .catch((error) => {
        logError("Load report", error);
        setLoadError(true);
        const retry = error instanceof ApiError && error.retryable ? { label: "다시 시도", onClick: loadReport } : undefined;
        toast.error(error instanceof Error ? error.message : "보고서를 불러올 수 없습니다.", retry);
      })
      .finally(() => setLoading(false));
  }, [filters, projectId, toast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const [deepResult, setDeepResult] = useState<AnalysisResult | null>(null);
  useEffect(() => {
    if (!report) {
      setDeepResult(null);
      return;
    }
    const deepRuns = report.modules.deep?.runs ?? [];
    const latestRun = deepRuns
      .map((entry) => entry.run)
      .filter((run) => run.status === "completed" && run.analysisResultId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (!latestRun?.analysisResultId) {
      setDeepResult(null);
      return;
    }
    let cancelled = false;
    fetchAnalysisResults(latestRun.analysisResultId)
      .then((result) => {
        if (!cancelled) setDeepResult(result);
      })
      .catch((error) => {
        logError("Load deep analysis result for report", error);
        if (!cancelled) setDeepResult(null);
      });
    return () => {
      cancelled = true;
    };
  }, [report]);

  const handleApplyFilters = useCallback(() => {
    setFilters(pendingFilters);
    setShowFilters(false);
  }, [pendingFilters]);

  const handleClearFilters = useCallback(() => {
    setPendingFilters({});
    setFilters({});
    setShowFilters(false);
  }, []);

  const hasActiveFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);

  const moduleEntries = useMemo(
    () => (report ? getReportModuleEntries(report, activeTab) : []),
    [activeTab, report],
  );
  const allFindings = useMemo(() => moduleEntries.flatMap((entry) => entry.mod!.findings), [moduleEntries]);
  const allRuns = useMemo(() => moduleEntries.flatMap((entry) => entry.mod!.runs), [moduleEntries]);
  const summary = useMemo(
    () => (report ? (activeTab === "all" ? report.totalSummary : moduleEntries[0]?.mod?.summary ?? report.totalSummary) : null),
    [activeTab, moduleEntries, report],
  );
  const sevCounts = useMemo(() => {
    if (!summary) {
      return { critical: 0, high: 0, medium: 0, low: 0 };
    }

    return {
      critical: summary.bySeverity.critical ?? 0,
      high: summary.bySeverity.high ?? 0,
      medium: summary.bySeverity.medium ?? 0,
      low: summary.bySeverity.low ?? 0,
    };
  }, [summary]);
  const sevMax = useMemo(() => Math.max(1, ...Object.values(sevCounts)), [sevCounts]);

  return {
    report,
    loading,
    loadError,
    activeTab,
    setActiveTab,
    showFilters,
    setShowFilters,
    showCustomReport,
    setShowCustomReport,
    filters,
    pendingFilters,
    setPendingFilters,
    hasActiveFilters,
    loadReport,
    handleApplyFilters,
    handleClearFilters,
    moduleEntries,
    allFindings,
    allRuns,
    summary,
    sevCounts,
    sevMax,
    deepResult,
  };
}
