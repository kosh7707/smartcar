import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult, UploadedFile, Vulnerability } from "@aegis/shared";
import {
  fetchFileContent,
  fetchProjectFiles,
  fetchProjectOverview,
  fetchSourceFileContent,
  logError,
} from "../../../api/client";
import { parseLocation } from "../../../utils/location";
import { highlightLines } from "../../../utils/highlight";

type ToastApi = {
  error: (message: string) => void;
};

export function useFileDetailPage(
  projectId: string | undefined,
  fileId: string | undefined,
  highlightLine: number,
  toast: ToastApi,
) {
  const highlightRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [sourceCode, setSourceCode] = useState<string | null>(null);
  const [serverLineCount, setServerLineCount] = useState<number | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);
  const [viewTab, setViewTab] = useState<"code" | "preview">("code");
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    document.title = "AEGIS — File Detail";
  }, []);

  useEffect(() => {
    if (!maximized) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMaximized(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [maximized]);

  const isSourceFile = fileId?.startsWith("source:") ?? false;
  const sourcePath = isSourceFile && fileId ? fileId.slice("source:".length) : null;

  useEffect(() => {
    if (!projectId || !fileId) return;
    setLoading(true);

    const loadFileData = async () => {
      if (isSourceFile && sourcePath) {
        const [sourceContent, overview] = await Promise.all([
          fetchSourceFileContent(projectId, sourcePath).catch(() => null),
          fetchProjectOverview(projectId),
        ]);
        const fileName = sourcePath.split("/").pop() || sourcePath;
        setFile({
          id: fileId,
          name: fileName,
          size: sourceContent?.size ?? 0,
          language: sourceContent?.language,
          path: sourcePath,
        });
        setServerLineCount(sourceContent?.lineCount ?? null);
        setSourceCode(sourceContent?.content ?? null);

        const filtered = overview.recentAnalyses
          .filter((analysis) => analysis.module === "static_analysis" || analysis.module === "deep_analysis")
          .filter((analysis) => analysis.vulnerabilities.some((vulnerability) => {
            if (!vulnerability.location) return false;
            const fileNameFromLocation = parseLocation(vulnerability.location).fileName;
            return fileNameFromLocation === sourcePath
              || fileNameFromLocation === fileName
              || fileNameFromLocation.split("/").pop() === fileName;
          }));
        setAnalyses(filtered);
        return;
      }

      const [files, overview, fileData] = await Promise.all([
        fetchProjectFiles(projectId),
        fetchProjectOverview(projectId),
        fetchFileContent(fileId).catch(() => null),
      ]);
      const found = files.find((candidate) => candidate.id === fileId);
      setFile(found ?? null);
      setSourceCode(fileData?.content ?? null);

      if (!found) {
        setAnalyses([]);
        return;
      }

      const filtered = overview.recentAnalyses
        .filter((analysis) => analysis.module === "static_analysis" || analysis.module === "deep_analysis")
        .filter((analysis) => {
          if (analysis.analyzedFileIds && analysis.analyzedFileIds.length > 0) {
            return analysis.analyzedFileIds.includes(fileId);
          }
          return analysis.vulnerabilities.some((vulnerability) => {
            if (!vulnerability.location) return false;
            const fileNameFromLocation = parseLocation(vulnerability.location).fileName;
            return fileNameFromLocation === found.name
              || fileNameFromLocation === found.path
              || fileNameFromLocation.split("/").pop() === found.name;
          });
        });
      setAnalyses(filtered);
    };

    loadFileData()
      .catch((error) => {
        logError("Load file detail", error);
        toast.error("파일 정보를 불러올 수 없습니다.");
      })
      .finally(() => setLoading(false));
  }, [fileId, isSourceFile, projectId, sourcePath, toast]);

  useEffect(() => {
    if (highlightLine > 0 && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightLine, loading]);

  const sourceLines = useMemo(() => sourceCode?.split("\n") ?? [], [sourceCode]);
  const highlightedSourceLines = useMemo(
    () => (sourceCode ? highlightLines(sourceCode, file?.language ?? undefined) : []),
    [file?.language, sourceCode],
  );

  const fileVulnerabilities = useMemo(() => {
    if (!file) return [];
    const result: Vulnerability[] = [];
    for (const analysis of analyses) {
      for (const vulnerability of analysis.vulnerabilities) {
        if (!vulnerability.location) continue;
        const fileNameFromLocation = parseLocation(vulnerability.location).fileName;
        if (
          fileNameFromLocation === file.name
          || fileNameFromLocation === file.path
          || fileNameFromLocation.split("/").pop() === file.name
        ) {
          result.push(vulnerability);
        }
      }
    }
    return result;
  }, [analyses, file]);

  const handleDownload = () => {
    if (!file || !sourceCode) return;
    const blob = new Blob([sourceCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return {
    file,
    loading,
    sourceCode,
    serverLineCount,
    analyses,
    selectedVulnerability,
    setSelectedVulnerability,
    viewTab,
    setViewTab,
    maximized,
    setMaximized,
    highlightRef,
    sourceLines,
    highlightedSourceLines,
    fileVulnerabilities,
    handleDownload,
  };
}
