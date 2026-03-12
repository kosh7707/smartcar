import React from "react";
import { FileSearch, Activity, FlaskConical } from "lucide-react";

export const MODULE_META: Record<string, { label: string; icon: React.ReactNode; path: string; badge: string }> = {
  static_analysis: { label: "정적 분석", icon: <FileSearch size={14} />, path: "static-analysis", badge: "static" },
  dynamic_analysis: { label: "동적 분석", icon: <Activity size={14} />, path: "dynamic-analysis", badge: "dynamic" },
  dynamic_testing: { label: "동적 테스트", icon: <FlaskConical size={14} />, path: "dynamic-test", badge: "test" },
};

export const MODULE_LABELS: { key: string; label: string }[] = [
  { key: "static_analysis", label: "정적" },
  { key: "dynamic_analysis", label: "동적" },
  { key: "dynamic_testing", label: "테스트" },
];

export function getModuleRoute(module: string, projectId: string, analysisId?: string): string {
  if (module === "static_analysis" && analysisId) {
    return `/projects/${projectId}/static-analysis?analysisId=${analysisId}`;
  }
  const meta = MODULE_META[module];
  return `/projects/${projectId}/${meta?.path ?? "static-analysis"}`;
}
