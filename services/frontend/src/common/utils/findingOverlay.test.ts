import { describe, it, expect } from "vitest";
import type { Finding } from "@aegis/shared";
import { computeFindingOverlay, getFindingCount } from "./findingOverlay";

function makeFinding(location: string, severity: string): Finding {
  return {
    id: `f-${Math.random()}`,
    runId: "run-1",
    projectId: "proj-1",
    module: "static_analysis",
    status: "open",
    severity: severity as Finding["severity"],
    confidence: "high",
    sourceType: "sast-tool",
    title: "Test",
    description: "Test",
    location,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

describe("computeFindingOverlay", () => {
  it("computes per-directory counts", () => {
    const findings = [
      makeFinding("gateway/src/main.c:10", "critical"),
      makeFinding("gateway/src/util.c:20", "high"),
      makeFinding("body/control.c:5", "medium"),
    ];
    const overlay = computeFindingOverlay(findings);

    // gateway/src should have 2 findings
    const gwSrc = getFindingCount("gateway/src", overlay);
    expect(gwSrc.total).toBe(2);
    expect(gwSrc.critical).toBe(1);
    expect(gwSrc.high).toBe(1);

    // gateway should have 2 findings (parent aggregation)
    const gw = getFindingCount("gateway", overlay);
    expect(gw.total).toBe(2);

    // body should have 1 finding
    const body = getFindingCount("body", overlay);
    expect(body.total).toBe(1);
    expect(body.medium).toBe(1);
  });

  it("handles findings without location", () => {
    const findings = [makeFinding("", "high")];
    // parseLocation returns "기타" for empty → skipped
    const overlay = computeFindingOverlay(findings);
    expect(overlay.size).toBe(0);
  });

  it("handles flat file paths (no directory)", () => {
    const findings = [makeFinding("main.c:5", "low")];
    const overlay = computeFindingOverlay(findings);
    // file-level entry only, no directory
    const file = getFindingCount("main.c", overlay);
    expect(file.total).toBe(1);
    expect(file.low).toBe(1);
  });

  it("returns empty counts for unknown path", () => {
    const overlay = computeFindingOverlay([]);
    const result = getFindingCount("nonexistent", overlay);
    expect(result.total).toBe(0);
    expect(result.critical).toBe(0);
  });

  it("ignores unknown severity values gracefully", () => {
    const findings = [makeFinding("src/a.c:1", "unknown" as string)];
    const overlay = computeFindingOverlay(findings);
    const result = getFindingCount("src/a.c", overlay);
    expect(result.total).toBe(1);
    // unknown severity not counted in any named bucket
    expect(result.critical).toBe(0);
    expect(result.high).toBe(0);
    expect(result.medium).toBe(0);
    expect(result.low).toBe(0);
  });
});
