import { describe, expect, it, vi } from "vitest";
import { AnalysisOrchestrator } from "../analysis-orchestrator";

describe("AnalysisOrchestrator", () => {
  it("broadcasts target-run progress on the root analysisId while keeping target-specific result ids", async () => {
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
        buildProfile: { sdkId: "sdk-default", compiler: "gcc", targetArch: "arm", languageStandard: "c11", headerLanguage: "c" },
      }]),
    };
    const targetLibraryDAO = {
      getIncludedPaths: vi.fn(() => []),
    };

    const orchestrator = new AnalysisOrchestrator(
      sourceService as any,
      sastClient as any,
      agentClient as any,
      analysisResultDAO as any,
      settingsService as any,
      resultNormalizer as any,
      ws as any,
      buildTargetService as any,
      targetLibraryDAO as any,
    );

    await orchestrator.runAnalysis("project-1", "analysis-root", ["target-1"], "req-1");

    expect(ws.broadcast).toHaveBeenCalled();
    for (const [broadcastKey, message] of ws.broadcast.mock.calls) {
      expect(broadcastKey).toBe("analysis-root");
      expect(message.payload.analysisId).toBe("analysis-root");
    }

    expect(analysisResultDAO.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: "analysis-root-gateway", projectId: "project-1", module: "static_analysis" }),
    );
    expect(analysisResultDAO.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: "deep-analysis-root-gateway", projectId: "project-1", module: "deep_analysis" }),
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
      agentClient as any,
      analysisResultDAO as any,
      settingsService as any,
      resultNormalizer as any,
      ws as any,
    );

    await orchestrator.runAnalysis("project-1", "analysis-root", undefined, "req-1");

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
});
