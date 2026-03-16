import { useState, useCallback, useRef, useEffect } from "react";
import type { AnalysisProgress, UploadedFile } from "@smartcar/shared";
import type { LocalFile } from "./useStaticAnalysis";
import {
  uploadFiles,
  runStaticAnalysisAsync,
  fetchAnalysisProgress,
  abortAnalysis as abortAnalysisApi,
  logError,
} from "../api/client";

export function useAsyncAnalysis(projectId?: string) {
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File selection state (ported from useStaticAnalysis)
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [selectedExisting, setSelectedExisting] = useState<UploadedFile[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      setIsRunning(true);
      pollRef.current = setInterval(async () => {
        try {
          const p = await fetchAnalysisProgress(id);
          setProgress(p);
          if (p.status !== "running") {
            stopPolling();
            setIsRunning(false);
            if (p.status === "failed") {
              setError(p.error ?? "분석 실패");
            }
          }
        } catch (e) {
          logError("Poll analysis progress", e);
        }
      }, 2500);
    },
    [stopPolling],
  );

  const startAnalysis = useCallback(
    async (pid: string, existingFiles: UploadedFile[]) => {
      setError(null);
      try {
        let allFiles: UploadedFile[] = [...existingFiles];

        if (files.length > 0) {
          const uploaded = await uploadFiles(pid, files.map((f) => f.file));
          allFiles = [...allFiles, ...uploaded];
        }

        const res = await runStaticAnalysisAsync(pid, allFiles);
        if (res.success && res.data) {
          setAnalysisId(res.data.analysisId);
          setProgress({
            analysisId: res.data.analysisId,
            projectId: pid,
            status: "running",
            phase: "queued",
            currentChunk: 0,
            totalChunks: 0,
            message: "분석 대기 중...",
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          startPolling(res.data.analysisId);
        } else {
          throw new Error(res.error ?? "분석 시작 실패");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "알 수 없는 오류");
        setIsRunning(false);
      }
    },
    [files, startPolling],
  );

  const abortCurrentAnalysis = useCallback(async (overrideId?: string) => {
    const id = overrideId || analysisId;
    if (!id) return;
    try {
      await abortAnalysisApi(id);
      stopPolling();
      setIsRunning(false);
      setProgress((prev) => prev ? { ...prev, status: "aborted" } : null);
    } catch (e) {
      logError("Abort analysis", e);
    }
  }, [analysisId, stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setAnalysisId(null);
    setProgress(null);
    setIsRunning(false);
    setError(null);
    setFiles([]);
    setSelectedExisting([]);
  }, [stopPolling]);

  // File management
  const addFiles = useCallback((newFiles: File[]) => {
    const locals: LocalFile[] = newFiles.map((f) => ({
      file: f,
      info: {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        size: f.size,
        language: f.name.endsWith(".py") ? "python" : "c",
      },
    }));
    setFiles((prev) => [...prev, ...locals]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleExistingFile = useCallback((file: UploadedFile) => {
    setSelectedExisting((prev) =>
      prev.find((f) => f.id === file.id)
        ? prev.filter((f) => f.id !== file.id)
        : [...prev, file],
    );
  }, []);

  const setAllExisting = useCallback((allFiles: UploadedFile[]) => {
    setSelectedExisting(allFiles);
  }, []);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  return {
    analysisId,
    progress,
    isRunning,
    error,
    startAnalysis,
    abortAnalysis: abortCurrentAnalysis,
    reset,
    files,
    selectedExisting,
    addFiles,
    removeFile,
    toggleExistingFile,
    setAllExisting,
  };
}
