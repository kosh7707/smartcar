import { describe, it, expect } from "vitest";
import { SEVERITY_ORDER, SEVERITY_COLORS, SEVERITY_LABELS, getSeverityColor } from "./severity";

describe("SEVERITY_ORDER", () => {
  it("has 5 severities in descending order", () => {
    expect(SEVERITY_ORDER).toEqual(["critical", "high", "medium", "low", "info"]);
  });
});

describe("SEVERITY_COLORS", () => {
  it("has a color for each severity", () => {
    for (const sev of SEVERITY_ORDER) {
      expect(SEVERITY_COLORS[sev]).toBeTruthy();
      expect(SEVERITY_COLORS[sev]).toMatch(/^var\(--severity-/);
    }
  });
});

describe("SEVERITY_LABELS", () => {
  it("has a label for each severity", () => {
    for (const sev of SEVERITY_ORDER) {
      expect(SEVERITY_LABELS[sev]).toBeTruthy();
    }
  });
});

describe("getSeverityColor", () => {
  it("returns color for known severity", () => {
    expect(getSeverityColor("critical")).toBe("var(--severity-critical)");
    expect(getSeverityColor("low")).toBe("var(--severity-low)");
  });

  it("falls back to info color for unknown severity", () => {
    expect(getSeverityColor("unknown")).toBe("var(--severity-info)");
    expect(getSeverityColor("")).toBe("var(--severity-info)");
  });
});
