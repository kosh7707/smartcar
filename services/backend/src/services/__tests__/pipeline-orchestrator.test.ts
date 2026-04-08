import { describe, it, expect, vi, beforeEach } from "vitest";
import { PipelineOrchestrator } from "../pipeline-orchestrator";
import type { BuildTarget, BuildProfile } from "@aegis/shared";

// ── Mock factories ──

function makeTarget(overrides: Partial<BuildTarget> = {}): BuildTarget {
  return {
    id: "t1",
    projectId: "p1",
    name: "gateway",
    relativePath: "gateway/",
    buildProfile: { sdkId: "linux-x86_64-c", compiler: "gcc", headerLanguage: "c" } as BuildProfile,
    status: "discovered",
    createdAt: "2026-03-25T00:00:00Z",
    updatedAt: "2026-03-25T00:00:00Z",
    ...overrides,
  };
}

const scanResponse = {
  status: "completed" as const,
  stats: { findingsTotal: 5, elapsedMs: 3000, toolsRun: ["cppcheck"] },
  findings: [
    { ruleId: "CK001", toolId: "cppcheck", severity: "warning", message: "Null pointer", location: { file: "main.c", line: 10 } },
  ],
  codeGraph: { functions: [{ name: "main", file: "main.c" }], callEdges: [] },
  sca: { libraries: [{ name: "openssl", version: "1.1.1" }] },
};

const resolveSuccess = {
  taskId: "resolve-1",
  taskType: "build-resolve",
  status: "completed" as const,
  modelProfile: "v1",
  promptVersion: "v1",
  schemaVersion: "v1",
  validation: { valid: true, errors: [] },
  result: {
    summary: "OK",
    claims: [],
    caveats: [],
    usedEvidenceRefs: [],
    confidence: 0.9,
    confidenceBreakdown: { grounding: 1, deterministicSupport: 1, ragCoverage: 0.5, schemaCompliance: 1 },
    needsHumanReview: false,
    buildResult: {
      success: true,
      buildCommand: "bash build-aegis/aegis-build.sh",
      buildScript: "build-aegis/aegis-build.sh",
      buildDir: "build-aegis",
      errorLog: null,
    },
  },
  audit: { inputHash: "sha256:x", latencyMs: 5000, tokenUsage: { prompt: 100, completion: 50 }, retryCount: 0, createdAt: "2026-03-25T00:00:00Z" },
};

const resolveFail = {
  taskId: "resolve-1",
  taskType: "build-resolve",
  status: "build_failed" as const,
  failureCode: "BUILD_FAILED",
  failureDetail: "cmake failed",
  retryable: false,
};

function createMocks() {
  const sourceService = { getProjectPath: vi.fn().mockReturnValue("/uploads/p1") };
  const sastClient = {
    build: vi.fn().mockResolvedValue({ success: true, compileCommandsPath: "/uploads/p1/build/cc.json", entries: 10 }),
    scan: vi.fn().mockResolvedValue(scanResponse),
    identifyLibraries: vi.fn().mockResolvedValue([]),
  };
  const kbClient = {
    ingestCodeGraph: vi.fn().mockResolvedValue({ nodes_created: 20, edges_created: 5 }),
    checkReady: vi.fn().mockResolvedValue({ status: "ready", degraded: false }),
  };
  const buildAgentClient = {
    submitTask: vi.fn().mockResolvedValue(resolveSuccess),
    isSuccess: vi.fn().mockImplementation((r: any) => r.status === "completed"),
  };
  const targetLibraryDAO = {
    upsertFromScan: vi.fn().mockReturnValue([]),
    getIncludedPaths: vi.fn().mockReturnValue([]),
    findByTargetId: vi.fn().mockReturnValue([]),
  };
  const buildTargetDAO = {
    findByProjectId: vi.fn().mockReturnValue([makeTarget()]),
    findById: vi.fn().mockImplementation((id: string) => makeTarget({ id })),
    updatePipelineState: vi.fn().mockImplementation((_id: string, _fields: any) => makeTarget()),
    update: vi.fn().mockImplementation((_id: string, _fields: any) => makeTarget()),
  };
  const analysisResultDAO = { save: vi.fn() };
  const resultNormalizer = { normalizeAnalysisResult: vi.fn() };
  const ws = { broadcast: vi.fn() };
  const notificationService = { emit: vi.fn() };

  const orchestrator = new PipelineOrchestrator(
    sourceService as any,
    sastClient as any,
    kbClient as any,
    buildAgentClient as any,
    targetLibraryDAO as any,
    buildTargetDAO as any,
    analysisResultDAO as any,
    resultNormalizer as any,
    ws as any,
    notificationService as any,
  );

  return { orchestrator, sourceService, sastClient, kbClient, buildAgentClient, targetLibraryDAO, buildTargetDAO, analysisResultDAO, resultNormalizer, ws, notificationService };
}

describe("PipelineOrchestrator", () => {
  it("happy path: resolve → build → scan → graph → ready", async () => {
    const { orchestrator, buildAgentClient, buildTargetDAO, sastClient, kbClient, ws, notificationService } = createMocks();

    await orchestrator.runPipeline("p1");

    // resolve 호출됨
    expect(buildAgentClient.submitTask).toHaveBeenCalledOnce();
    expect(buildAgentClient.submitTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: "build-resolve",
        contractVersion: "build-resolve-v1",
        strictMode: true,
        context: {
          trusted: expect.objectContaining({
            projectPath: "/uploads/p1/gateway/",
            subprojectPath: "gateway/",
            subprojectName: "gateway",
            targetPath: "gateway/",
            targetName: "gateway",
          }),
        },
      }),
      undefined,
      undefined,
    );
    expect(buildTargetDAO.updatePipelineState).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "configured" }));

    // build 호출됨
    expect(sastClient.build).toHaveBeenCalledOnce();
    expect(sastClient.build).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPath: "/uploads/p1/gateway/",
        buildCommand: "bash build-aegis/aegis-build.sh",
      }),
      undefined,
      undefined,
    );
    expect(buildTargetDAO.updatePipelineState).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "built" }));

    // scan 호출됨
    expect(sastClient.scan).toHaveBeenCalledOnce();
    expect(buildTargetDAO.updatePipelineState).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "scanned" }));

    // graph 호출됨
    expect(kbClient.ingestCodeGraph).toHaveBeenCalledOnce();

    // ready
    expect(buildTargetDAO.updatePipelineState).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "ready" }));

    // pipeline-complete broadcast
    expect(ws.broadcast).toHaveBeenCalledWith("p1", expect.objectContaining({ type: "pipeline-complete" }));
    expect(ws.broadcast).toHaveBeenCalledWith("p1", expect.objectContaining({
      type: "pipeline-complete",
      payload: expect.objectContaining({ pipelineId: expect.stringMatching(/^pipe-/) }),
    }));
    expect(notificationService.emit).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "p1",
      type: "analysis_complete",
      jobKind: "pipeline",
      resourceId: expect.stringMatching(/^pipe-/),
      correlationId: expect.stringMatching(/^pipe-/),
    }));
  });

  it("skips resolve if target already has buildCommand", async () => {
    const { orchestrator, buildAgentClient, buildTargetDAO } = createMocks();
    buildTargetDAO.findByProjectId.mockReturnValue([
      makeTarget({ status: "configured", buildCommand: "make all" }),
    ]);

    await orchestrator.runPipeline("p1");

    expect(buildAgentClient.submitTask).not.toHaveBeenCalled();
  });

  it("resolve failure without materialized build command → stops before build", async () => {
    const { orchestrator, buildAgentClient, buildTargetDAO, sastClient, ws, notificationService } = createMocks();
    buildAgentClient.submitTask.mockResolvedValue(resolveFail);
    buildAgentClient.isSuccess.mockReturnValue(false);

    await orchestrator.runPipeline("p1");

    // resolve_failed 상태가 저장됨
    expect(buildTargetDAO.updatePipelineState).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "resolve_failed" }));
    expect(sastClient.build).not.toHaveBeenCalled();
    expect(ws.broadcast).toHaveBeenCalledWith("p1", expect.objectContaining({ type: "pipeline-error" }));
    expect(notificationService.emit).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "p1",
      type: "gate_failed",
      jobKind: "pipeline",
    }));
  });

  it("resolve failure without profile → throws", async () => {
    const { orchestrator, buildAgentClient, buildTargetDAO, ws } = createMocks();
    buildAgentClient.submitTask.mockResolvedValue(resolveFail);
    buildAgentClient.isSuccess.mockReturnValue(false);
    buildTargetDAO.findByProjectId.mockReturnValue([
      makeTarget({ buildProfile: {} as BuildProfile }),
    ]);

    await orchestrator.runPipeline("p1");

    // pipeline-error broadcast
    expect(ws.broadcast).toHaveBeenCalledWith("p1", expect.objectContaining({ type: "pipeline-error" }));
  });

  it("build failure → build_failed status", async () => {
    const { orchestrator, buildTargetDAO, sastClient, ws, notificationService } = createMocks();
    buildTargetDAO.findByProjectId.mockReturnValue([
      makeTarget({ status: "configured", buildCommand: "make" }),
    ]);
    sastClient.build.mockResolvedValue({ success: false, error: "missing deps" });

    await orchestrator.runPipeline("p1");

    expect(buildTargetDAO.updatePipelineState).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "build_failed" }));
    expect(ws.broadcast).toHaveBeenCalledWith("p1", expect.objectContaining({ type: "pipeline-error" }));
    expect(notificationService.emit).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "p1",
      type: "gate_failed",
      jobKind: "pipeline",
    }));
  });

  it("scan failure → scan_failed status", async () => {
    const { orchestrator, buildTargetDAO, sastClient, ws } = createMocks();
    buildTargetDAO.findByProjectId.mockReturnValue([
      makeTarget({ status: "configured", buildCommand: "make" }),
    ]);
    sastClient.scan.mockResolvedValue({ status: "error", error: "timeout" });

    await orchestrator.runPipeline("p1");

    expect(buildTargetDAO.updatePipelineState).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "scan_failed" }));
  });

  it("graph failure → non-fatal, still reaches ready", async () => {
    const { orchestrator, buildTargetDAO, kbClient } = createMocks();
    buildTargetDAO.findByProjectId.mockReturnValue([
      makeTarget({ status: "configured", buildCommand: "make" }),
    ]);
    kbClient.ingestCodeGraph.mockRejectedValue(new Error("KB down"));

    await orchestrator.runPipeline("p1");

    // graph fail is non-fatal — should still reach ready
    expect(buildTargetDAO.updatePipelineState).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "ready" }));
  });

  it("no source path → throws NotFoundError", async () => {
    const { orchestrator, sourceService } = createMocks();
    sourceService.getProjectPath.mockReturnValue(null);

    await expect(orchestrator.runPipeline("p1")).rejects.toThrow("not found");
  });

  it("no targets → throws NotFoundError", async () => {
    const { orchestrator, buildTargetDAO } = createMocks();
    buildTargetDAO.findByProjectId.mockReturnValue([]);

    await expect(orchestrator.runPipeline("p1")).rejects.toThrow("No build targets");
  });

  it("multiple targets with mixed results", async () => {
    const { orchestrator, buildTargetDAO, sastClient, ws } = createMocks();

    const t1 = makeTarget({ id: "t1", name: "ok-target", status: "configured", buildCommand: "make" });
    const t2 = makeTarget({ id: "t2", name: "fail-target", status: "configured", buildCommand: "make" });
    buildTargetDAO.findByProjectId.mockReturnValue([t1, t2]);

    let callCount = 0;
    sastClient.build.mockImplementation(() => {
      callCount++;
      if (callCount === 2) return Promise.resolve({ success: false, error: "fail" });
      return Promise.resolve({ success: true, compileCommandsPath: "/cc.json", entries: 5 });
    });

    await orchestrator.runPipeline("p1");

    // pipeline-complete should have readyCount=1, failedCount=1
    const completeCall = ws.broadcast.mock.calls.find(
      (call: any[]) => call[1].type === "pipeline-complete",
    );
    expect(completeCall).toBeDefined();
    expect(completeCall![1].payload.pipelineId).toMatch(/^pipe-/);
    expect(completeCall![1].payload.readyCount).toBe(1);
    expect(completeCall![1].payload.failedCount).toBe(1);
  });

  it("WS broadcasts target status changes", async () => {
    const { orchestrator, buildTargetDAO, ws } = createMocks();
    buildTargetDAO.findByProjectId.mockReturnValue([
      makeTarget({ status: "configured", buildCommand: "make" }),
    ]);

    await orchestrator.runPipeline("p1");

    const statusMessages = ws.broadcast.mock.calls
      .filter((call: any[]) => call[1].type === "pipeline-target-status")
      .map((call: any[]) => call[1].payload.status);

    const targetStatusCalls = ws.broadcast.mock.calls
      .filter((call: any[]) => call[1].type === "pipeline-target-status");
    for (const [, msg] of targetStatusCalls) {
      expect(msg.payload.pipelineId).toMatch(/^pipe-/);
    }

    expect(statusMessages).toContain("building");
    expect(statusMessages).toContain("built");
    expect(statusMessages).toContain("scanning");
    expect(statusMessages).toContain("scanned");
    expect(statusMessages).toContain("ready");
  });
});
