import { describe, it, expect } from "vitest";
import { DEFAULT_ADAPTER_URL, DEFAULT_LLM_URL, POLL_HEALTH_MS, POLL_ACTIVE_ANALYSIS_MS } from "./defaults";

describe("defaults", () => {
  it("DEFAULT_ADAPTER_URL is a valid ws URL", () => {
    expect(DEFAULT_ADAPTER_URL).toMatch(/^wss?:\/\//);
  });

  it("DEFAULT_LLM_URL is a valid http URL", () => {
    expect(DEFAULT_LLM_URL).toMatch(/^https?:\/\//);
  });

  it("POLL_HEALTH_MS is a reasonable interval", () => {
    expect(POLL_HEALTH_MS).toBeGreaterThanOrEqual(5_000);
    expect(POLL_HEALTH_MS).toBeLessThanOrEqual(120_000);
  });

  it("POLL_ACTIVE_ANALYSIS_MS is shorter than health poll", () => {
    expect(POLL_ACTIVE_ANALYSIS_MS).toBeLessThan(POLL_HEALTH_MS);
    expect(POLL_ACTIVE_ANALYSIS_MS).toBeGreaterThanOrEqual(1_000);
  });
});
