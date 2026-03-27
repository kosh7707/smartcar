import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createAnalysisRouter } from "../analysis.controller";
import { errorHandlerMiddleware } from "../../middleware/error-handler.middleware";

/**
 * analysis.controller의 mode 검증 로직 단위 테스트.
 * orchestrator/tracker는 mock으로 주입 — 202 이후 비동기 로직은 검증하지 않는다.
 */

function createMockOrchestrator() {
  return {
    runAnalysis: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockTracker() {
  return {
    start: vi.fn().mockReturnValue(new AbortController()),
    complete: vi.fn(),
    fail: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    get: vi.fn(),
    abort: vi.fn(),
  };
}

function buildApp() {
  const orchestrator = createMockOrchestrator();
  const tracker = createMockTracker();
  const app = express();
  app.use(express.json());
  app.use(
    "/api/analysis",
    createAnalysisRouter(
      orchestrator as any,
      { findByProjectId: vi.fn().mockReturnValue([]), findById: vi.fn(), findAll: vi.fn(), findByModule: vi.fn(), save: vi.fn(), deleteById: vi.fn() } as any,
      tracker as any,
      { findByProjectId: vi.fn().mockReturnValue([]) } as any,
      { findByProjectId: vi.fn().mockReturnValue([]) } as any,
      { findByProjectId: vi.fn().mockReturnValue([]) } as any,
      { submitTask: vi.fn() } as any,
      { getProjectPath: vi.fn().mockReturnValue("/tmp") } as any,
    ),
  );
  app.use(errorHandlerMiddleware);
  return { app, orchestrator, tracker };
}

describe("POST /api/analysis/run — mode validation", () => {
  let app: express.Express;

  beforeEach(() => {
    ({ app } = buildApp());
  });

  it('mode: "subproject" without targetIds → 400', async () => {
    const res = await request(app)
      .post("/api/analysis/run")
      .send({ projectId: "p1", mode: "subproject" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errorDetail.message).toMatch(/targetIds.*required/);
  });

  it('mode: "full" with targetIds → 400', async () => {
    const res = await request(app)
      .post("/api/analysis/run")
      .send({ projectId: "p1", mode: "full", targetIds: ["t1"] });

    expect(res.status).toBe(400);
    expect(res.body.errorDetail.message).toMatch(/targetIds.*empty/);
  });

  it('mode: "banana" → 400', async () => {
    const res = await request(app)
      .post("/api/analysis/run")
      .send({ projectId: "p1", mode: "banana" });

    expect(res.status).toBe(400);
    expect(res.body.errorDetail.message).toMatch(/mode must be/);
  });

  it('mode: "subproject" with targetIds → 202', async () => {
    const res = await request(app)
      .post("/api/analysis/run")
      .send({ projectId: "p1", mode: "subproject", targetIds: ["t1"] });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("analysisId");
  });

  it('mode: "full" without targetIds → 202', async () => {
    const res = await request(app)
      .post("/api/analysis/run")
      .send({ projectId: "p1", mode: "full" });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
  });

  it("mode omitted, targetIds present → 202 (backward compatible)", async () => {
    const res = await request(app)
      .post("/api/analysis/run")
      .send({ projectId: "p1", targetIds: ["t1"] });

    expect(res.status).toBe(202);
  });

  it("mode omitted, no targetIds → 202 (backward compatible)", async () => {
    const res = await request(app)
      .post("/api/analysis/run")
      .send({ projectId: "p1" });

    expect(res.status).toBe(202);
  });

  it("missing projectId → 400", async () => {
    const res = await request(app)
      .post("/api/analysis/run")
      .send({ mode: "full" });

    expect(res.status).toBe(400);
  });
});
