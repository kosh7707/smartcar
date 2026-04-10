import type { Finding, Severity } from "@aegis/shared";
import { parseLocation } from "./location";

export interface DirFindingCount {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

const EMPTY: DirFindingCount = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
const VALID_SEVERITIES = new Set<string>(["critical", "high", "medium", "low"]);

function increment(map: Map<string, DirFindingCount>, key: string, severity: Severity) {
  let entry = map.get(key);
  if (!entry) {
    entry = { ...EMPTY };
    map.set(key, entry);
  }
  if (VALID_SEVERITIES.has(severity)) {
    entry[severity as keyof Omit<DirFindingCount, "total">] += 1;
  }
  entry.total += 1;
}

/**
 * Compute per-directory finding counts.
 * For each finding, walks up the directory hierarchy and accumulates counts.
 * Returns a Map keyed by directory path (e.g. "gateway/src", "gateway").
 * Also keyed by full file path for file-level lookup.
 */
export function computeFindingOverlay(findings: Finding[]): Map<string, DirFindingCount> {
  const map = new Map<string, DirFindingCount>();

  for (const f of findings) {
    const { fileName } = parseLocation(f.location);
    if (fileName === "기타" || !fileName) continue;

    // Increment the file itself
    increment(map, fileName, f.severity);

    // Walk up directories
    const parts = fileName.split("/");
    for (let i = parts.length - 1; i > 0; i--) {
      const dirPath = parts.slice(0, i).join("/");
      increment(map, dirPath, f.severity);
    }
  }

  return map;
}

/** Get finding count for a given path, or empty. */
export function getFindingCount(
  path: string,
  overlay: Map<string, DirFindingCount>,
): DirFindingCount {
  return overlay.get(path) ?? EMPTY;
}
