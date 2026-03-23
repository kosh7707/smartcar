import { describe, it, expect } from "vitest";
import { MODULE_META, MODULE_LABELS, getModuleRoute } from "./modules";

describe("MODULE_META", () => {
  it("has static_analysis and deep_analysis", () => {
    expect(MODULE_META.static_analysis).toBeDefined();
    expect(MODULE_META.deep_analysis).toBeDefined();
  });

  it("each module has required fields", () => {
    for (const [, meta] of Object.entries(MODULE_META)) {
      expect(meta.label).toBeTruthy();
      expect(meta.icon).toBeDefined();
      expect(meta.path).toBeTruthy();
      expect(meta.badge).toBeTruthy();
    }
  });
});

describe("MODULE_LABELS", () => {
  it("has 2 entries", () => {
    expect(MODULE_LABELS).toHaveLength(2);
  });

  it("includes static and deep", () => {
    expect(MODULE_LABELS.find((m) => m.key === "static_analysis")).toBeDefined();
    expect(MODULE_LABELS.find((m) => m.key === "deep_analysis")).toBeDefined();
  });
});

describe("getModuleRoute", () => {
  it("returns analysis route with analysisId", () => {
    const route = getModuleRoute("static_analysis", "proj-1", "analysis-1");
    expect(route).toBe("/projects/proj-1/static-analysis?analysisId=analysis-1");
  });

  it("returns analysis route for deep_analysis with analysisId", () => {
    const route = getModuleRoute("deep_analysis", "proj-1", "analysis-2");
    expect(route).toBe("/projects/proj-1/static-analysis?analysisId=analysis-2");
  });

  it("returns base module route without analysisId", () => {
    const route = getModuleRoute("static_analysis", "proj-1");
    expect(route).toBe("/projects/proj-1/static-analysis");
  });

  it("falls back to static-analysis for unknown module", () => {
    const route = getModuleRoute("unknown_module", "proj-1");
    expect(route).toBe("/projects/proj-1/static-analysis");
  });
});
