import { describe, it, expect } from "vitest";
import { ARTIFACT_TYPE_LABELS, LOCATOR_TYPE_LABELS } from "./evidence";

describe("evidence constants", () => {
  it("ARTIFACT_TYPE_LABELS has all expected types", () => {
    expect(ARTIFACT_TYPE_LABELS["analysis-result"]).toBeDefined();
    expect(ARTIFACT_TYPE_LABELS["uploaded-file"]).toBeDefined();
    expect(ARTIFACT_TYPE_LABELS["dynamic-session"]).toBeDefined();
    expect(ARTIFACT_TYPE_LABELS["test-result"]).toBeDefined();
  });

  it("LOCATOR_TYPE_LABELS has all expected types", () => {
    expect(LOCATOR_TYPE_LABELS["line-range"]).toBeDefined();
    expect(LOCATOR_TYPE_LABELS["packet-range"]).toBeDefined();
    expect(LOCATOR_TYPE_LABELS["timestamp-window"]).toBeDefined();
    expect(LOCATOR_TYPE_LABELS["request-response-pair"]).toBeDefined();
  });

  it("all labels are non-empty Korean strings", () => {
    for (const label of Object.values(ARTIFACT_TYPE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
    for (const label of Object.values(LOCATOR_TYPE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
