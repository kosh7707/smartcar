import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHealthRouter } from "../health.controller";

describe("health.controller", () => {
  it("treats S4 policy degradation as degraded service health", async () => {
    const app = express();
    app.use(createHealthRouter(
      { checkHealth: vi.fn().mockResolvedValue({ status: "ok" }) } as any,
      { findAll: vi.fn().mockReturnValue([]) } as any,
      { checkHealth: vi.fn().mockResolvedValue({ status: "ok" }) } as any,
      { checkHealth: vi.fn().mockResolvedValue({ status: "ok", policyStatus: "failed", policyReasons: ["runtime-tool-missing"] }) } as any,
      { checkHealth: vi.fn().mockResolvedValue({ status: "ok" }) } as any,
      { checkHealth: vi.fn().mockResolvedValue({ status: "ok" }) } as any,
    ));

    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("degraded");
    expect(res.body.sastRunner.status).toBe("degraded");
    expect(res.body.sastRunner.detail.policyStatus).toBe("failed");
  });
});
