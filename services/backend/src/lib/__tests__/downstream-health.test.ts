import { describe, expect, it } from "vitest";
import { buildHealthCheckUrl, normalizeControlSummary, toDownstreamServiceHealth } from "../downstream-health";

describe("downstream-health", () => {
  it("builds request-aware health URLs", () => {
    expect(buildHealthCheckUrl("http://localhost:8001", "req-123"))
      .toBe("http://localhost:8001/v1/health?requestId=req-123");
    expect(buildHealthCheckUrl("http://localhost:8000"))
      .toBe("http://localhost:8000/v1/health");
  });

  it("normalizes frozen request-summary fields into continue_waiting", () => {
    const summary = normalizeControlSummary({
      activeRequestCount: 1,
      requestSummary: {
        requestId: "req-1",
        endpoint: "tasks",
        state: "running",
        localAckState: "phase-advancing",
        degraded: false,
        degradeReasons: [],
        lastAckAt: 123,
        lastAckSource: "tool-complete",
        blockedReason: null,
      },
    });

    expect(summary).toMatchObject({
      activeRequestCount: 1,
      requestId: "req-1",
      endpoint: "tasks",
      state: "running",
      localAckState: "phase-advancing",
      pollDecision: "continue_waiting",
    });
  });

  it("maps legacy ackStatus into localAckState and chain_abort", () => {
    const serviceHealth = toDownstreamServiceHealth({
      status: "ok",
      requestSummary: {
        requestId: "req-scan",
        endpoint: "scan",
        state: "failed",
        ackStatus: "broken",
        degraded: true,
        degradeReasons: ["tool-failure"],
        blockedReason: "tool-crashed",
      },
    });

    expect(serviceHealth).toMatchObject({
      status: "degraded",
      control: {
        requestId: "req-scan",
        localAckState: "ack-break",
        pollDecision: "chain_abort",
      },
    });
  });
});
