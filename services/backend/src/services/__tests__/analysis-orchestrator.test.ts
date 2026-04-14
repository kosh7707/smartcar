import { describe, expect, it, vi } from "vitest";
import { AnalysisOrchestrator } from "../analysis-orchestrator";

describe("AnalysisOrchestrator", () => {
  it("legacy run alias keeps root analysisId in WS while target-scoped Quick result ids stay distinct", async () => {
    const sourceService = {
      getProjectPath: vi.fn(() => "/tmp/project"),
      listFiles: vi.fn(() => [{ relativePath: "src/main.c" }]),
    };
    const sastClient = {
      scan: vi.fn(async () => ({
        success: true,
        scanId: "scan-1",
        status: "completed",
        findings: [],
        stats: { filesScanned: 1, rulesRun: 0, findingsTotal: 0, elapsedMs: 1 },
        execution: { toolsRun: [], toolResults: {} },
        codeGraph: null,
        sca: null,
      })),
    };
    const kbClient = {
      ingestCodeGraph: vi.fn(async () => ({
        success: true,
        project_id: "project-1:gateway",
        nodes_created: 1,
        edges_created: 0,
        elapsed_ms: 1,
        status: "ready",
        readiness: { graphRag: true },
      })),
      isGraphReady: vi.fn(() => true),
    };
    const agentClient = {
      submitTask: vi.fn(async () => ({
        result: {
          claims: [],
          confidence: 0.9,
        },
        audit: { latencyMs: 1 },
      })),
      isSuccess: vi.fn(() => true),
    };
    const analysisResultDAO = {
      save: vi.fn(),
    };
    const settingsService = {
      getAll: vi.fn(() => ({})),
    };
    const resultNormalizer = {
      normalizeAnalysisResult: vi.fn(),
      normalizeAgentResult: vi.fn(),
    };
    const ws = {
      broadcast: vi.fn(),
    };
    const buildTargetService = {
      findByProjectId: vi.fn(() => [{
        id: "target-1",
        name: "gateway",
        relativePath: "gateway/",
        compileCommandsPath: "/tmp/project/gateway/compile_commands.json",
        buildProfile: { sdkId: "sdk-default", compiler: "gcc", targetArch: "arm", languageStandard: "c11", headerLanguage: "c" },
      }]),
    };
    const targetLibraryDAO = {
      getIncludedPaths: vi.fn(() => []),
    };

    const orchestrator = new AnalysisOrchestrator(
      sourceService as any,
      sastClient as any,
      kbClient as any,
      agentClient as any,
      analysisResultDAO as any,
      settingsService as any,
      resultNormalizer as any,
      ws as any,
      buildTargetService as any,
      targetLibraryDAO as any,
    );

    await orchestrator.runAnalysis("project-1", "analysis-root", ["target-1"], "req-1");

    expect(sastClient.scan).toHaveBeenCalledWith(
      expect.objectContaining({
        compileCommands: "/tmp/project/gateway/compile_commands.json",
      }),
      "req-1",
      undefined,
    );

    expect(ws.broadcast).toHaveBeenCalled();
    for (const [broadcastKey, message] of ws.broadcast.mock.calls) {
      expect(broadcastKey).toBe("analysis-root");
      expect(message.payload.analysisId).toBe("analysis-root");
    }

    expect(agentClient.submitTask).not.toHaveBeenCalled();
    expect(analysisResultDAO.save).toHaveBeenCalledOnce();
    expect(analysisResultDAO.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: "analysis-root-gateway", projectId: "project-1", module: "static_analysis" }),
    );
  });

  it("stops after quick phase when S4 returns failed scan response", async () => {
    const sourceService = {
      getProjectPath: vi.fn(() => "/tmp/project"),
      listFiles: vi.fn(() => [{ relativePath: "src/main.c" }]),
    };
    const sastClient = {
      scan: vi.fn(async () => ({
        success: false,
        scanId: "scan-omission",
        status: "failed",
        findings: [],
        stats: { filesScanned: 0, rulesRun: 0, findingsTotal: 0, elapsedMs: 0 },
        execution: { toolsRun: [], toolResults: {} },
        error: "Disallowed tool omission",
        errorDetail: { code: "DISALLOWED_TOOL_OMISSION", retryable: false },
      })),
    };
    const kbClient = {
      ingestCodeGraph: vi.fn(),
      isGraphReady: vi.fn(() => true),
    };
    const agentClient = {
      submitTask: vi.fn(),
      isSuccess: vi.fn(() => true),
    };
    const analysisResultDAO = {
      save: vi.fn(),
    };
    const settingsService = {
      getAll: vi.fn(() => ({})),
    };
    const resultNormalizer = {
      normalizeAnalysisResult: vi.fn(),
      normalizeAgentResult: vi.fn(),
    };
    const ws = {
      broadcast: vi.fn(),
    };

    const orchestrator = new AnalysisOrchestrator(
      sourceService as any,
      sastClient as any,
      kbClient as any,
      agentClient as any,
      analysisResultDAO as any,
      settingsService as any,
      resultNormalizer as any,
      ws as any,
    );

    await expect(orchestrator.runAnalysis("project-1", "analysis-root", undefined, "req-1"))
      .rejects.toThrow(/Disallowed tool omission/);

    expect(agentClient.submitTask).not.toHaveBeenCalled();
    expect(analysisResultDAO.save).not.toHaveBeenCalled();
    expect(ws.broadcast).toHaveBeenCalledWith(
      "analysis-root",
      expect.objectContaining({
        type: "analysis-error",
        payload: expect.objectContaining({
          phase: "quick",
          error: "Disallowed tool omission",
          retryable: false,
        }),
      }),
    );
  });

  it("legacy run alias completes Quick with GraphRAG-ready ingest without auto-starting Deep", async () => {
    const sourceService = {
      getProjectPath: vi.fn(() => "/tmp/project"),
      listFiles: vi.fn(() => [{ relativePath: "src/main.c" }]),
    };
    const sastClient = {
      scan: vi.fn(async () => ({
        success: true,
        scanId: "scan-1",
        status: "completed",
        findings: [{ ruleId: "CK001", toolId: "cppcheck", severity: "warning", message: "Null pointer", location: { file: "src/main.c", line: 10 } }],
        stats: { filesScanned: 1, rulesRun: 1, findingsTotal: 1, elapsedMs: 1 },
        execution: { toolsRun: [], toolResults: {} },
        codeGraph: {
          functions: [{ name: "main", file: "src/main.c", line: 1 }],
          callEdges: [],
        },
        sca: { libraries: [{ name: "openssl", version: "1.1.1", path: "vendor/openssl" }] },
      })),
    };
    const kbClient = {
      ingestCodeGraph: vi.fn(async () => ({
        success: true,
        project_id: "project-1",
        nodes_created: 4,
        edges_created: 2,
        elapsed_ms: 3,
        status: "ready",
        readiness: { graphRag: true, neo4jGraph: true, vectorIndex: true },
      })),
      isGraphReady: vi.fn(() => true),
    };
    const agentClient = {
      submitTask: vi.fn(async () => ({
        status: "completed",
        result: {
          claims: [],
          confidence: 0.9,
          caveats: [],
          recommendedNextSteps: [],
          policyFlags: [],
          confidenceBreakdown: { grounding: 1, deterministicSupport: 1, ragCoverage: 1, schemaCompliance: 1 },
          needsHumanReview: false,
        },
        audit: { latencyMs: 1 },
      })),
      isSuccess: vi.fn(() => true),
    };
    const analysisResultDAO = { save: vi.fn() };
    const settingsService = { getAll: vi.fn(() => ({})) };
    const resultNormalizer = { normalizeAnalysisResult: vi.fn(), normalizeAgentResult: vi.fn() };
    const ws = { broadcast: vi.fn() };

    const orchestrator = new AnalysisOrchestrator(
      sourceService as any,
      sastClient as any,
      kbClient as any,
      agentClient as any,
      analysisResultDAO as any,
      settingsService as any,
      resultNormalizer as any,
      ws as any,
    );

    await orchestrator.runAnalysis("project-1", "analysis-1", undefined, "req-1");

    expect(kbClient.ingestCodeGraph).toHaveBeenCalledOnce();
    expect(agentClient.submitTask).not.toHaveBeenCalled();
    expect(analysisResultDAO.save).toHaveBeenCalledOnce();
    expect(ws.broadcast).toHaveBeenCalledWith(
      "analysis-1",
      expect.objectContaining({
        type: "analysis-quick-complete",
        payload: expect.objectContaining({
          analysisId: "analysis-1",
          findingCount: 1,
        }),
      }),
    );
  });

  it("stops after quick phase when GraphRAG ingest is not ready", async () => {
    const sourceService = {
      getProjectPath: vi.fn(() => "/tmp/project"),
      listFiles: vi.fn(() => [{ relativePath: "src/main.c" }]),
    };
    const sastClient = {
      scan: vi.fn(async () => ({
        success: true,
        scanId: "scan-1",
        status: "completed",
        findings: [],
        stats: { filesScanned: 1, rulesRun: 0, findingsTotal: 0, elapsedMs: 1 },
        execution: { toolsRun: [], toolResults: {} },
        codeGraph: { functions: [{ name: "main", file: "src/main.c", line: 1 }], callEdges: [] },
        sca: null,
      })),
    };
    const kbClient = {
      ingestCodeGraph: vi.fn(async () => ({
        success: true,
        project_id: "project-1",
        nodes_created: 1,
        edges_created: 0,
        elapsed_ms: 1,
        status: "partial",
        readiness: { graphRag: false, neo4jGraph: true, vectorIndex: false },
        warnings: ["VECTOR_INDEX_INCOMPLETE"],
      })),
      isGraphReady: vi.fn(() => false),
    };
    const agentClient = {
      submitTask: vi.fn(),
      isSuccess: vi.fn(() => true),
    };
    const analysisResultDAO = { save: vi.fn() };
    const settingsService = { getAll: vi.fn(() => ({})) };
    const resultNormalizer = { normalizeAnalysisResult: vi.fn(), normalizeAgentResult: vi.fn() };
    const ws = { broadcast: vi.fn() };

    const orchestrator = new AnalysisOrchestrator(
      sourceService as any,
      sastClient as any,
      kbClient as any,
      agentClient as any,
      analysisResultDAO as any,
      settingsService as any,
      resultNormalizer as any,
      ws as any,
    );

    await expect(orchestrator.runAnalysis("project-1", "analysis-1", undefined, "req-1"))
      .rejects.toThrow(/Quick graph context not ready/);

    expect(agentClient.submitTask).not.toHaveBeenCalled();
    expect(ws.broadcast).toHaveBeenCalledWith(
      "analysis-1",
      expect.objectContaining({
        type: "analysis-error",
        payload: expect.objectContaining({
          phase: "quick",
          error: expect.stringContaining("Quick graph context not ready"),
        }),
      }),
    );
  });

  it("runQuickAnalysis completes Quick without invoking Deep", async () => {
    const sourceService = {
      getProjectPath: vi.fn(() => "/tmp/project"),
      listFiles: vi.fn(() => [{ relativePath: "src/main.c" }]),
    };
    const sastClient = {
      scan: vi.fn(async () => ({
        success: true,
        scanId: "scan-1",
        status: "completed",
        findings: [],
        stats: { filesScanned: 1, rulesRun: 0, findingsTotal: 0, elapsedMs: 1 },
        execution: { toolsRun: [], toolResults: {} },
        codeGraph: null,
        sca: null,
      })),
    };
    const kbClient = {
      ingestCodeGraph: vi.fn(),
      isGraphReady: vi.fn(() => true),
      getCodeGraphStats: vi.fn(),
    };
    const agentClient = {
      submitTask: vi.fn(),
      isSuccess: vi.fn(() => true),
    };
    const analysisResultDAO = { save: vi.fn() };
    const settingsService = { getAll: vi.fn(() => ({})) };
    const resultNormalizer = { normalizeAnalysisResult: vi.fn(), normalizeAgentResult: vi.fn() };
    const ws = { broadcast: vi.fn() };

    const orchestrator = new AnalysisOrchestrator(
      sourceService as any,
      sastClient as any,
      kbClient as any,
      agentClient as any,
      analysisResultDAO as any,
      settingsService as any,
      resultNormalizer as any,
      ws as any,
    );

    await orchestrator.runQuickAnalysis("project-1", "analysis-1", undefined, "req-1");

    expect(agentClient.submitTask).not.toHaveBeenCalled();
    expect(analysisResultDAO.save).toHaveBeenCalledOnce();
    expect(ws.broadcast).toHaveBeenCalledWith(
      "analysis-1",
      expect.objectContaining({ type: "analysis-quick-complete" }),
    );
  });

  it("runQuickAnalysis with target requires prepared compile_commands", async () => {
    const sourceService = {
      getProjectPath: vi.fn(() => "/tmp/project"),
      listFiles: vi.fn(() => [{ relativePath: "src/main.c" }]),
    };
    const sastClient = {
      scan: vi.fn(),
    };
    const kbClient = {
      ingestCodeGraph: vi.fn(),
      isGraphReady: vi.fn(() => true),
      getCodeGraphStats: vi.fn(),
    };
    const agentClient = {
      submitTask: vi.fn(),
      isSuccess: vi.fn(() => true),
    };
    const analysisResultDAO = { save: vi.fn() };
    const settingsService = { getAll: vi.fn(() => ({})) };
    const resultNormalizer = { normalizeAnalysisResult: vi.fn(), normalizeAgentResult: vi.fn() };
    const ws = { broadcast: vi.fn() };
    const buildTargetService = {
      findByProjectId: vi.fn(() => [{
        id: "target-1",
        name: "gateway",
        relativePath: "gateway/",
        buildProfile: { sdkId: "sdk-default", compiler: "gcc", targetArch: "arm", languageStandard: "c11", headerLanguage: "c" },
      }]),
    };
    const targetLibraryDAO = { getIncludedPaths: vi.fn(() => []) };

    const orchestrator = new AnalysisOrchestrator(
      sourceService as any,
      sastClient as any,
      kbClient as any,
      agentClient as any,
      analysisResultDAO as any,
      settingsService as any,
      resultNormalizer as any,
      ws as any,
      buildTargetService as any,
      targetLibraryDAO as any,
    );

    await expect(orchestrator.runQuickAnalysis("project-1", "analysis-1", ["target-1"], "req-1"))
      .rejects.toThrow(/Build preparation required before Quick/);
    expect(sastClient.scan).not.toHaveBeenCalled();
  });

  it("runDeepAnalysis uses prior quick result and KB graph stats", async () => {
    const sourceService = {
      getProjectPath: vi.fn(() => "/tmp/project"),
      listFiles: vi.fn(() => [{ relativePath: "src/main.c" }]),
    };
    const sastClient = {
      scan: vi.fn(),
    };
    const kbClient = {
      ingestCodeGraph: vi.fn(),
      isGraphReady: vi.fn(() => true),
      getCodeGraphStats: vi.fn(async () => ({ project_id: "project-1", function_count: 3, call_edge_count: 2 })),
    };
    const agentClient = {
      submitTask: vi.fn(async () => ({
        status: "completed",
        result: {
          claims: [],
          confidence: 0.9,
          caveats: [],
          recommendedNextSteps: [],
          policyFlags: [],
          confidenceBreakdown: { grounding: 1, deterministicSupport: 1, ragCoverage: 1, schemaCompliance: 1 },
          needsHumanReview: false,
        },
        audit: { latencyMs: 1 },
      })),
      isSuccess: vi.fn(() => true),
    };
    const analysisResultDAO = {
      save: vi.fn(),
      findById: vi.fn((id: string) => id === "analysis-quick-1" ? {
        id,
        projectId: "project-1",
        module: "static_analysis",
        status: "completed",
        vulnerabilities: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        scaLibraries: [{ name: "openssl", version: "1.1.1" }],
        createdAt: new Date().toISOString(),
      } : undefined),
    };
    const settingsService = { getAll: vi.fn(() => ({ buildProfile: { sdkId: "sdk-default" } })) };
    const resultNormalizer = { normalizeAnalysisResult: vi.fn(), normalizeAgentResult: vi.fn() };
    const ws = { broadcast: vi.fn() };

    const orchestrator = new AnalysisOrchestrator(
      sourceService as any,
      sastClient as any,
      kbClient as any,
      agentClient as any,
      analysisResultDAO as any,
      settingsService as any,
      resultNormalizer as any,
      ws as any,
    );

    await orchestrator.runDeepAnalysis("project-1", "analysis-deep-1", "analysis-quick-1", "req-1");

    expect(kbClient.getCodeGraphStats).toHaveBeenCalledWith("project-1", "req-1");
    expect(agentClient.submitTask).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          trusted: expect.objectContaining({
            quickContext: expect.objectContaining({ quickAnalysisId: "analysis-quick-1" }),
            graphContext: expect.objectContaining({ kbProjectId: "project-1", functionCount: 3 }),
          }),
        },
      }),
      "req-1",
      undefined,
    );
    expect(ws.broadcast).toHaveBeenCalledWith(
      "analysis-deep-1",
      expect.objectContaining({ type: "analysis-deep-complete" }),
    );
  });
});
