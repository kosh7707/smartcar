import type { AnalysisResult, UploadedFile, Vulnerability } from "@aegis/shared";
import type { GateResult } from "@/common/api/gate";

export interface SeveritySummary {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  info?: number;
}

export interface OverviewTrend {
  newFindings: number;
  resolvedFindings: number;
  unresolvedTotal: number;
}

export interface GateCounts {
  pass: number;
  fail: number;
  warning: number;
}

export function getTopVulnerabilities(analyses: AnalysisResult[], count = 5): Vulnerability[] {
  const all: Vulnerability[] = [];
  for (const analysis of analyses) {
    if (analysis.status !== "completed") continue;
    if (Array.isArray(analysis.vulnerabilities)) {
      all.push(...analysis.vulnerabilities);
    }
  }

  const order: Vulnerability["severity"][] = ["critical", "high", "medium", "low", "info"];
  return all
    .sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
    .slice(0, count);
}

export function getGateCounts(gates: GateResult[]): GateCounts {
  return gates.reduce<GateCounts>((counts, gate) => {
    counts[gate.status] += 1;
    return counts;
  }, { pass: 0, fail: 0, warning: 0 });
}

export function getTotalFindings(severity: SeveritySummary): number {
  return (severity.critical ?? 0) + (severity.high ?? 0) + (severity.medium ?? 0) + (severity.low ?? 0);
}

export function isOverviewEmpty(recentAnalyses: AnalysisResult[], projectFiles: UploadedFile[]): boolean {
  return recentAnalyses.length === 0 && projectFiles.length === 0;
}

export function hasTrendSignal(trend?: OverviewTrend | null): boolean {
  return Boolean(trend && (trend.newFindings > 0 || trend.resolvedFindings > 0 || trend.unresolvedTotal > 0));
}

export function getSdkStatusLabel(status: string): string {
  if (status === "ready") return "사용 가능";
  if (status.endsWith("_failed")) return "실패";
  return "진행 중";
}

export function getSdkStatusToneClass(status: string): string {
  if (status === "ready") return "overview-sdk-badge overview-sdk-badge--ready";
  if (status.endsWith("_failed")) return "overview-sdk-badge overview-sdk-badge--failed";
  return "overview-sdk-badge overview-sdk-badge--progress";
}
