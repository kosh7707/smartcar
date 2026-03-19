import React from "react";
import { FileSearch, Bot } from "lucide-react";

export const MODULE_META: Record<string, { label: string; icon: React.ReactNode; path: string; badge: string }> = {
  static_analysis: { label: "정적 분석", icon: <FileSearch size={14} />, path: "static-analysis", badge: "static" },
  deep_analysis: { label: "심층 분석", icon: <Bot size={14} />, path: "static-analysis", badge: "deep" },
};

export const MODULE_LABELS: { key: string; label: string }[] = [
  { key: "static_analysis", label: "정적" },
  { key: "deep_analysis", label: "심층" },
];

export function getModuleRoute(module: string, projectId: string, analysisId?: string): string {
  if ((module === "static_analysis" || module === "deep_analysis") && analysisId) {
    return `/projects/${projectId}/static-analysis?analysisId=${analysisId}`;
  }
  const meta = MODULE_META[module];
  return `/projects/${projectId}/${meta?.path ?? "static-analysis"}`;
}
