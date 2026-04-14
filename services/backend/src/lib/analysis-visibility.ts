import type { AnalysisModule, AnalysisResult, Finding, Run } from "@aegis/shared";

type ScopedAnalysisArtifact = Pick<
  AnalysisResult | Finding | Run,
  "module" | "buildTargetId" | "analysisExecutionId"
>;

export function requiresBuildTargetExecution(module: AnalysisModule): boolean {
  return module === "static_analysis" || module === "deep_analysis";
}

export function isVisibleAnalysisArtifact(artifact: ScopedAnalysisArtifact): boolean {
  return !requiresBuildTargetExecution(artifact.module)
    || (!!artifact.buildTargetId && !!artifact.analysisExecutionId);
}

export function assertBuildTargetExecutionLineage(module: AnalysisModule, buildTargetId?: string, analysisExecutionId?: string): void {
  if (process.env.AEGIS_ALLOW_LEGACY_STATIC_FIXTURES === "1") {
    return;
  }
  if (requiresBuildTargetExecution(module) && (!buildTargetId || !analysisExecutionId)) {
    throw new Error(`BuildTarget-owned ${module} artifact requires buildTargetId and analysisExecutionId`);
  }
}
