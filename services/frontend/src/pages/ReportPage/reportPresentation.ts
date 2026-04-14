import type { AnalysisModule, ProjectReport } from "@aegis/shared";

export type ModuleTab = "all" | "static" | "deep" | "dynamic" | "test";

export const MODULE_TAB_LABELS: Record<ModuleTab, string> = {
  all: "전체",
  static: "정적 분석",
  deep: "심층 분석",
  dynamic: "동적 분석",
  test: "동적 테스트",
};

export const MODULE_KEY_MAP: Record<string, AnalysisModule> = {
  static: "static_analysis",
  deep: "deep_analysis",
  dynamic: "dynamic_analysis",
  test: "dynamic_testing",
};

export type ReportModuleEntry = {
  key: string;
  mod: NonNullable<ProjectReport["modules"][keyof ProjectReport["modules"]]>;
};

export function getReportModuleEntries(report: ProjectReport, activeTab: ModuleTab) {
  const activeModules = activeTab === "all"
    ? (["static", "deep", "dynamic", "test"] as const)
    : [activeTab] as const;

  return activeModules
    .map((key) => ({ key, mod: report.modules[key] }))
    .filter((entry): entry is ReportModuleEntry => entry.mod != null);
}
