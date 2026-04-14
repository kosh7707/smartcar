import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createAnalysisRouter } from "../analysis.controller";
import { errorHandlerMiddleware } from "../../middleware/error-handler.middleware";
import { NotFoundError } from "../../lib/errors";

function createMockOrchestrator() {
  return {
    preflightQuickRequest: vi.fn(),
    preflightDeepRequest: vi.fn(),
    runQuickAnalysis: vi.fn().mockResolvedValue(undefined),
    runDeepAnalysis: vi.fn().mockResolvedValue(undefined),
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

describe("analysis execution validation", () => {
  let app: express.Express;
  let orchestrator: ReturnType<typeof createMockOrchestrator>;

  beforeEach(() => {
    ({ app, orchestrator } = buildApp());
  });

  it("POST /api/analysis/run is absent after cutover", async () => {
    const res = await request(app)
      .post("/api/analysis/run")
      .send({ projectId: "p1", buildTargetId: "t1" });

    expect(res.status).toBe(404);
  });

  it("POST /api/analysis/quick rejects legacy mode semantics", async () => {
    const res = await request(app)
      .post("/api/analysis/quick")
      .send({ projectId: "p1", mode: "full", targetIds: ["t1"] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errorDetail.message).toMatch(/mode is no longer supported/);
  });

  it("POST /api/analysis/quick requires buildTargetId", async () => {
    const res = await request(app)
      .post("/api/analysis/quick")
      .send({ projectId: "p1" });

    expect(res.status).toBe(400);
    expect(res.body.errorDetail.message).toMatch(/buildTargetId is required/);
  });

  it("POST /api/analysis/quick returns 202 for explicit BuildTarget identity", async () => {
    const res = await request(app)
      .post("/api/analysis/quick")
      .send({ projectId: "p1", buildTargetId: "t1" });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("analysisId");
    expect(res.body.data.buildTargetId).toBe("t1");
    expect(res.body.data.executionId).toBe(res.body.data.analysisId);
    expect(orchestrator.runQuickAnalysis).toHaveBeenCalledWith(
      "p1",
      expect.stringMatching(/^analysis-/),
      ["t1"],
      undefined,
      expect.any(AbortSignal),
    );
  });

  it("POST /api/analysis/quick surfaces synchronous BuildTarget preflight failures", async () => {
    vi.mocked(orchestrator.preflightQuickRequest).mockImplementation(() => {
      throw new NotFoundError("BuildTarget not found: missing-target");
    });

    const res = await request(app)
      .post("/api/analysis/quick")
      .send({ projectId: "p1", buildTargetId: "missing-target" });

    expect(res.status).toBe(404);
    expect(res.body.errorDetail.message).toMatch(/BuildTarget not found/);
    expect(orchestrator.runQuickAnalysis).not.toHaveBeenCalled();
  });

  it("POST /api/analysis/deep rejects legacy quickAnalysisId payloads", async () => {
    const res = await request(app)
      .post("/api/analysis/deep")
      .send({ projectId: "p1", buildTargetId: "t1", quickAnalysisId: "analysis-quick-1" });

    expect(res.status).toBe(400);
    expect(res.body.errorDetail.message).toMatch(/quickAnalysisId is no longer supported/);
  });

  it("POST /api/analysis/deep requires buildTargetId", async () => {
    const res = await request(app)
      .post("/api/analysis/deep")
      .send({ projectId: "p1", executionId: "exec-1" });

    expect(res.status).toBe(400);
    expect(res.body.errorDetail.message).toMatch(/buildTargetId is required/);
  });

  it("POST /api/analysis/deep requires executionId", async () => {
    const res = await request(app)
      .post("/api/analysis/deep")
      .send({ projectId: "p1", buildTargetId: "t1" });

    expect(res.status).toBe(400);
    expect(res.body.errorDetail.message).toMatch(/executionId is required/);
  });

  it("POST /api/analysis/deep returns 202 for explicit BuildTarget + execution lineage", async () => {
    const res = await request(app)
      .post("/api/analysis/deep")
      .send({ projectId: "p1", buildTargetId: "t1", executionId: "exec-1" });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analysisId).toMatch(/^analysis-/);
    expect(res.body.data.buildTargetId).toBe("t1");
    expect(res.body.data.executionId).toBe("exec-1");
    expect(orchestrator.runDeepAnalysis).toHaveBeenCalledWith(
      "p1",
      expect.stringMatching(/^analysis-/),
      "t1",
      "exec-1",
      undefined,
      expect.any(AbortSignal),
    );
  });

  it("POST /api/analysis/deep surfaces synchronous execution/buildTarget preflight failures", async () => {
    vi.mocked(orchestrator.preflightDeepRequest).mockImplementation(() => {
      throw new NotFoundError("AnalysisExecution not found: exec-missing");
    });

    const res = await request(app)
      .post("/api/analysis/deep")
      .send({ projectId: "p1", buildTargetId: "t1", executionId: "exec-missing" });

    expect(res.status).toBe(404);
    expect(res.body.errorDetail.message).toMatch(/AnalysisExecution not found/);
    expect(orchestrator.runDeepAnalysis).not.toHaveBeenCalled();
  });
});
