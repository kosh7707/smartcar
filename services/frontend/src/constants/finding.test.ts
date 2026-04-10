import { describe, it, expect } from "vitest";
import type { FindingStatus, FindingSourceType } from "@aegis/shared";
import {
  FINDING_STATUS_LABELS,
  FINDING_STATUS_ORDER,
  ALLOWED_TRANSITIONS,
  canTransitionTo,
  SOURCE_TYPE_LABELS,
  CONFIDENCE_LABELS,
} from "./finding";

describe("FINDING_STATUS_LABELS", () => {
  it("has a label for every status in order", () => {
    for (const status of FINDING_STATUS_ORDER) {
      expect(FINDING_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("has 7 statuses", () => {
    expect(Object.keys(FINDING_STATUS_LABELS)).toHaveLength(7);
  });
});

describe("ALLOWED_TRANSITIONS", () => {
  it("has transitions for every status", () => {
    for (const status of FINDING_STATUS_ORDER) {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(ALLOWED_TRANSITIONS[status])).toBe(true);
    }
  });

  it("open can transition to 4 states", () => {
    expect(ALLOWED_TRANSITIONS.open).toHaveLength(4);
    expect(ALLOWED_TRANSITIONS.open).toContain("needs_review");
    expect(ALLOWED_TRANSITIONS.open).toContain("fixed");
  });

  it("fixed can transition to needs_revalidation and open", () => {
    expect(ALLOWED_TRANSITIONS.fixed).toContain("needs_revalidation");
    expect(ALLOWED_TRANSITIONS.fixed).toContain("open");
  });
});

describe("canTransitionTo", () => {
  it("allows valid transitions for rule-engine findings", () => {
    expect(canTransitionTo("open", "fixed", "rule-engine")).toBe(true);
    expect(canTransitionTo("open", "accepted_risk", "rule-engine")).toBe(true);
    expect(canTransitionTo("open", "needs_review", "rule-engine")).toBe(true);
  });

  it("blocks disallowed transitions", () => {
    expect(canTransitionTo("open", "needs_revalidation", "rule-engine")).toBe(false);
    expect(canTransitionTo("fixed", "accepted_risk", "rule-engine")).toBe(false);
  });

  it("blocks LLM-assist findings from accepted_risk and fixed", () => {
    expect(canTransitionTo("open", "accepted_risk", "llm-assist")).toBe(false);
    expect(canTransitionTo("open", "fixed", "llm-assist")).toBe(false);
    // But can go to needs_review
    expect(canTransitionTo("open", "needs_review", "llm-assist")).toBe(true);
  });

  it("blocks agent findings from accepted_risk and fixed", () => {
    expect(canTransitionTo("open", "accepted_risk", "agent")).toBe(false);
    expect(canTransitionTo("open", "fixed", "agent")).toBe(false);
    expect(canTransitionTo("open", "needs_review", "agent")).toBe(true);
  });

  it("allows sast-tool findings same as rule-engine", () => {
    expect(canTransitionTo("open", "fixed", "sast-tool")).toBe(true);
    expect(canTransitionTo("open", "accepted_risk", "sast-tool")).toBe(true);
  });

  it("allows sandbox to needs_review", () => {
    expect(canTransitionTo("sandbox", "needs_review", "llm-assist")).toBe(true);
    expect(canTransitionTo("sandbox", "open", "agent")).toBe(true);
  });
});

describe("SOURCE_TYPE_LABELS", () => {
  it("has labels for all 5 source types", () => {
    const types: FindingSourceType[] = ["rule-engine", "llm-assist", "both", "agent", "sast-tool"];
    for (const t of types) {
      expect(SOURCE_TYPE_LABELS[t]).toBeTruthy();
    }
  });
});

describe("CONFIDENCE_LABELS", () => {
  it("has labels for high/medium/low", () => {
    expect(CONFIDENCE_LABELS.high).toBeTruthy();
    expect(CONFIDENCE_LABELS.medium).toBeTruthy();
    expect(CONFIDENCE_LABELS.low).toBeTruthy();
  });
});
