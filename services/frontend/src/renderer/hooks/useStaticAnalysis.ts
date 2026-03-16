import { useState, useCallback } from "react";
import type {
  AnalysisResult,
  Vulnerability,
  UploadedFile,
} from "@smartcar/shared";
import { uploadFiles, runStaticAnalysis } from "../api/client";

export type AnalysisView = "upload" | "progress" | "results";

export interface LocalFile {
  file: File;
  info: UploadedFile;
}

export function useStaticAnalysis(projectId?: string) {
  const [view, setView] = useState<AnalysisView>("upload");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [selectedExisting, setSelectedExisting] = useState<UploadedFile[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const setAllExisting = useCallback((files: UploadedFile[]) => {
    setSelectedExisting(files);
  }, []);

  const runAnalysis = useCallback(async (overrideExisting?: UploadedFile[]) => {
    if (!projectId) return;
    const existing = overrideExisting ?? selectedExisting;
    if (files.length === 0 && existing.length === 0) return;

    setView("progress");
    setProgress(0);
    setError(null);

    try {
      let allFiles: UploadedFile[] = [...existing];

      if (files.length > 0) {
        setProgressStep("[1/3] 새 파일 업로드 중...");
        setProgress(20);
        const uploaded = await uploadFiles(projectId, files.map((f) => f.file));
        allFiles = [...allFiles, ...uploaded];
      } else {
        setProgress(20);
      }

      setProgressStep("[2/3] 분석 실행 중...");
      setProgress(60);
      const res = await runStaticAnalysis(projectId, allFiles);

      setProgressStep("[3/3] 결과 처리 중...");
      setProgress(100);

      if (res.success && res.data) {
        setResult(res.data);
        setView("results");
      } else {
        throw new Error(res.error ?? "분석 실패");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
      setView("upload");
    }
  }, [files, selectedExisting, projectId]);

  const reset = useCallback(() => {
    setView("upload");
    setFiles([]);
    setSelectedExisting([]);
    setProgress(0);
    setProgressStep("");
    setResult(null);
    setSelectedVuln(null);
    setError(null);
  }, []);

  return {
    view,
    files,
    selectedExisting,
    progress,
    progressStep,
    result,
    selectedVuln,
    error,
    addFiles,
    removeFile,
    toggleExistingFile,
    setAllExisting,
    runAnalysis,
    setSelectedVuln,
    reset,
  };
}
