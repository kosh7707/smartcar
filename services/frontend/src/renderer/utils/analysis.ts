import type { AnalysisResult } from "@smartcar/shared";
import { parseLocation } from "./location";

export function extractFiles(analysis: AnalysisResult): string[] {
  const files = new Set<string>();
  for (const v of analysis.vulnerabilities) {
    if (v.location) {
      const file = parseLocation(v.location).fileName;
      if (file) files.add(file);
    }
  }
  return [...files];
}

export function extractFileNames(analysis: AnalysisResult, maxCount = 3): string {
  const files = extractFiles(analysis).map((f) => {
    const slash = f.lastIndexOf("/");
    return slash >= 0 ? f.slice(slash + 1) : f;
  });
  if (files.length === 0) return "";
  if (files.length <= maxCount) return files.join(", ");
  return files.slice(0, maxCount).join(", ") + ` 외 ${files.length - maxCount}개`;
}
