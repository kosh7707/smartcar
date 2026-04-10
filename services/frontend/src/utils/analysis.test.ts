import { describe, it, expect } from "vitest";
import type { AnalysisResult } from "@aegis/shared";
import { extractFiles, extractFileNames } from "./analysis";

function makeAnalysis(locations: (string | undefined)[]): AnalysisResult {
  return {
    id: "a-1",
    projectId: "p-1",
    module: "static_analysis",
    status: "completed",
    vulnerabilities: locations.map((loc, i) => ({
      id: `v-${i}`,
      severity: "high" as const,
      title: `Vuln ${i}`,
      description: "",
      location: loc,
      source: "rule" as const,
    })),
    summary: { critical: 0, high: locations.length, medium: 0, low: 0, info: 0, total: locations.length },
    createdAt: "2026-01-01",
  };
}

describe("extractFiles", () => {
  it("extracts unique file paths from vulnerability locations", () => {
    const analysis = makeAnalysis([
      "src/main.c:10",
      "src/main.c:20",
      "src/util.c:5",
    ]);
    const files = extractFiles(analysis);
    expect(files).toHaveLength(2);
    expect(files).toContain("src/main.c");
    expect(files).toContain("src/util.c");
  });

  it("skips vulnerabilities without location", () => {
    const analysis = makeAnalysis([undefined, "file.c:1", undefined]);
    const files = extractFiles(analysis);
    expect(files).toHaveLength(1);
    expect(files).toContain("file.c");
  });

  it("returns empty for no vulnerabilities", () => {
    const analysis = makeAnalysis([]);
    expect(extractFiles(analysis)).toHaveLength(0);
  });
});

describe("extractFileNames", () => {
  it("returns comma-separated basenames", () => {
    const analysis = makeAnalysis(["src/a.c:1", "lib/b.c:2"]);
    expect(extractFileNames(analysis)).toBe("a.c, b.c");
  });

  it("truncates with count when exceeding maxCount", () => {
    const analysis = makeAnalysis(["a.c:1", "b.c:2", "c.c:3", "d.c:4"]);
    const result = extractFileNames(analysis, 2);
    expect(result).toBe("a.c, b.c 외 2개");
  });

  it("returns empty string for no files", () => {
    const analysis = makeAnalysis([]);
    expect(extractFileNames(analysis)).toBe("");
  });

  it("strips directory from filename", () => {
    const analysis = makeAnalysis(["deep/nested/path/file.c:1"]);
    expect(extractFileNames(analysis)).toBe("file.c");
  });

  it("respects default maxCount of 3", () => {
    const analysis = makeAnalysis(["a.c:1", "b.c:2", "c.c:3"]);
    expect(extractFileNames(analysis)).toBe("a.c, b.c, c.c");
  });
});
