import { useEffect, useMemo, useState } from "react";
import type { Run } from "@aegis/shared";
import { fetchProjectRuns, logError } from "@/common/api/client";

export type AnalysisHistoryFilter = "all" | "static_analysis" | "deep_analysis";

type ToastApi = {
  error: (message: string) => void;
};

export const ANALYSIS_HISTORY_FILTER_OPTIONS: Array<{ value: AnalysisHistoryFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "static_analysis", label: "정적 분석" },
  { value: "deep_analysis", label: "심층 분석" },
];

export function useAnalysisHistoryPageController(projectId: string | undefined, toast: ToastApi) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AnalysisHistoryFilter>("all");

  useEffect(() => {
    if (!projectId) {
      setRuns([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchProjectRuns(projectId)
      .then((data) => {
        if (cancelled) return;
        const sorted = [...data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setRuns(sorted);
      })
      .catch((error) => {
        if (cancelled) return;
        logError("Fetch analysis history", error);
        toast.error("분석 이력을 불러올 수 없습니다.");
        setRuns([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  const filteredRuns = useMemo(
    () => (filter === "all" ? runs : runs.filter((run) => run.module === filter)),
    [filter, runs],
  );

  const completedCount = useMemo(
    () => runs.filter((run) => run.status === "completed").length,
    [runs],
  );
  const failedCount = useMemo(
    () => runs.filter((run) => run.status === "failed").length,
    [runs],
  );

  return {
    loading,
    runs,
    filter,
    setFilter,
    filteredRuns,
    completedCount,
    failedCount,
  };
}
