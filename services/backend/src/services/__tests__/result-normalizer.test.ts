import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResultNormalizer, type NormalizerContext } from "../result-normalizer";
import type { IRunDAO, IFindingDAO, IEvidenceRefDAO } from "../../dao/interfaces";
import type { QualityGateService } from "../quality-gate.service";
import { makeAnalysisResult } from "../../test/factories";
import type { AnalysisResult, Run, Finding, Vulnerability } from "@aegis/shared";

// minimal mock for better-sqlite3 DatabaseType
function createMockDb(): any {
  const tx = vi.fn((fn: Function) => {
    // transaction() returns a function that executes fn()
    return (...args: any[]) => fn(...args);
  });
  return { transaction: tx };
}

function createMockRunDAO(): IRunDAO {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByProjectId: vi.fn(),
    findByAnalysisResultId: vi.fn().mockReturnValue(undefined),
    updateFindingCount: vi.fn(),
    trendByModule: vi.fn(),
    findLatestCompletedRuns: vi.fn().mockReturnValue([]),
  };
}

function createMockFindingDAO(): IFindingDAO {
  return {
    save: vi.fn(),
    saveMany: vi.fn(),
    findById: vi.fn(),
    findByRunId: vi.fn(),
    findByProjectId: vi.fn(),
    findByIds: vi.fn().mockReturnValue([]),
    findByFingerprint: vi.fn().mockReturnValue(undefined),
    findAllByFingerprint: vi.fn().mockReturnValue([]),
    updateStatus: vi.fn(),
    withTransaction: vi.fn((fn: any) => fn()),
    summaryByProjectId: vi.fn(),
    summaryByModule: vi.fn(),
    topFilesByModule: vi.fn(),
    topRulesByModule: vi.fn(),
    unresolvedCountByProjectId: vi.fn().mockReturnValue(0),
    severitySummaryByProjectId: vi.fn().mockReturnValue({ critical: 0, high: 0, medium: 0, low: 0 }),
    resolvedCountSince: vi.fn().mockReturnValue(0),
  };
}

function createMockEvidenceRefDAO(): IEvidenceRefDAO {
  return {
    save: vi.fn(),
    saveMany: vi.fn(),
    findByFindingId: vi.fn().mockReturnValue([]),
    findByFindingIds: vi.fn().mockReturnValue(new Map()),
  };
}

function createMockGateService(): QualityGateService {
  return {
    evaluateRun: vi.fn().mockReturnValue({ status: "pass" }),
    applyOverride: vi.fn(),
    getById: vi.fn(),
    getByRunId: vi.fn(),
    getByProjectId: vi.fn(),
  } as any;
}

let vulnCounter = 0;
function makeVuln(overrides?: Partial<Vulnerability>): Vulnerability {
  return {
    id: `vuln-${++vulnCounter}`,
    severity: "medium",
    title: "Test Vuln",
    description: "Test description",
    source: "rule",
    ...overrides,
  };
}

describe("ResultNormalizer", () => {
  let normalizer: ResultNormalizer;
  let db: any;
  let runDAO: IRunDAO;
  let findingDAO: IFindingDAO;
  let evidenceRefDAO: IEvidenceRefDAO;
  let gateService: QualityGateService;

  beforeEach(() => {
    db = createMockDb();
    runDAO = createMockRunDAO();
    findingDAO = createMockFindingDAO();
    evidenceRefDAO = createMockEvidenceRefDAO();
    gateService = createMockGateService();
    normalizer = new ResultNormalizer(db, runDAO, findingDAO, evidenceRefDAO, gateService);
  });

  describe("idempotency", () => {
    it("skips normalization if already normalized", () => {
      const existingRun = { id: "run-existing" } as Run;
      vi.mocked(runDAO.findByAnalysisResultId).mockReturnValue(existingRun);

      const result = normalizer.normalizeAnalysisResult(makeAnalysisResult());
      expect(result).toBe(existingRun);
      expect(runDAO.save).not.toHaveBeenCalled();
      expect(findingDAO.save).not.toHaveBeenCalled();
    });
  });

  describe("vulnerability classification", () => {
    it("classifies rule-source vulns as open/high/rule-engine", () => {
      const analysisResult = makeAnalysisResult({
        module: "static_analysis",
        vulnerabilities: [makeVuln({ source: "rule" })],
      });

      const run = normalizer.normalizeAnalysisResult(analysisResult);
      expect(run).toBeDefined();

      const savedFinding = vi.mocked(findingDAO.save).mock.calls[0][0] as Finding;
      expect(savedFinding.status).toBe("open");
      expect(savedFinding.confidence).toBe("high");
      expect(savedFinding.sourceType).toBe("rule-engine");
    });

    it("classifies llm-source vulns as sandbox/medium/llm-assist", () => {
      const analysisResult = makeAnalysisResult({
        module: "static_analysis",
        vulnerabilities: [makeVuln({ source: "llm" })],
      });

      const run = normalizer.normalizeAnalysisResult(analysisResult);
      expect(run).toBeDefined();

      const savedFinding = vi.mocked(findingDAO.save).mock.calls[0][0] as Finding;
      expect(savedFinding.status).toBe("sandbox");
      expect(savedFinding.confidence).toBe("medium");
      expect(savedFinding.sourceType).toBe("llm-assist");
    });

    it("classifies dynamic_testing with LLM analysis as needs_review/both", () => {
      const analysisResult = makeAnalysisResult({
        module: "dynamic_testing",
        vulnerabilities: [makeVuln({ description: "LLM 분석: something" })],
      });

      const run = normalizer.normalizeAnalysisResult(analysisResult);
      expect(run).toBeDefined();

      const savedFinding = vi.mocked(findingDAO.save).mock.calls[0][0] as Finding;
      expect(savedFinding.status).toBe("needs_review");
      expect(savedFinding.sourceType).toBe("both");
    });

    it("classifies dynamic_testing without LLM analysis as open/rule-engine", () => {
      const analysisResult = makeAnalysisResult({
        module: "dynamic_testing",
        vulnerabilities: [makeVuln({ description: "Regular description" })],
      });

      const run = normalizer.normalizeAnalysisResult(analysisResult);
      expect(run).toBeDefined();

      const savedFinding = vi.mocked(findingDAO.save).mock.calls[0][0] as Finding;
      expect(savedFinding.status).toBe("open");
      expect(savedFinding.sourceType).toBe("rule-engine");
    });

    it("assigns high confidence for critical/high dynamic_testing findings", () => {
      const analysisResult = makeAnalysisResult({
        module: "dynamic_testing",
        vulnerabilities: [makeVuln({ severity: "critical" })],
      });

      normalizer.normalizeAnalysisResult(analysisResult);
      const savedFinding = vi.mocked(findingDAO.save).mock.calls[0][0] as Finding;
      expect(savedFinding.confidence).toBe("high");
    });

    it("assigns medium confidence for medium/low dynamic_testing findings", () => {
      const analysisResult = makeAnalysisResult({
        module: "dynamic_testing",
        vulnerabilities: [makeVuln({ severity: "low" })],
      });

      normalizer.normalizeAnalysisResult(analysisResult);
      const savedFinding = vi.mocked(findingDAO.save).mock.calls[0][0] as Finding;
      expect(savedFinding.confidence).toBe("medium");
    });
  });

  describe("evidence references", () => {
    it("always creates analysis-result evidence ref", () => {
      const analysisResult = makeAnalysisResult({
        id: "ar-1",
        module: "static_analysis",
        vulnerabilities: [makeVuln()],
      });

      normalizer.normalizeAnalysisResult(analysisResult);
      const savedRef = vi.mocked(evidenceRefDAO.save).mock.calls[0][0];
      expect(savedRef.artifactId).toBe("ar-1");
      expect(savedRef.artifactType).toBe("analysis-result");
      expect(savedRef.locatorType).toBe("line-range");
    });

    it("links uploaded file for static_analysis when file matches location", () => {
      const analysisResult = makeAnalysisResult({
        module: "static_analysis",
        vulnerabilities: [makeVuln({ location: "main.c:10-20" })],
      });
      const context: NormalizerContext = {
        analyzedFiles: [{ id: "file-1", filePath: "main.c" }],
      };

      normalizer.normalizeAnalysisResult(analysisResult, context);

      // Should have 2 evidence refs: analysis-result + uploaded-file
      expect(evidenceRefDAO.save).toHaveBeenCalledTimes(2);
      const fileRef = vi.mocked(evidenceRefDAO.save).mock.calls[1][0];
      expect(fileRef.artifactId).toBe("file-1");
      expect(fileRef.artifactType).toBe("uploaded-file");
      expect(fileRef.locatorType).toBe("line-range");
      expect(fileRef.locator).toEqual({
        file: "main.c",
        startLine: 10,
        endLine: 20,
      });
    });

    it("does NOT link uploaded file when location does not match any file (prevents over-linking)", () => {
      const analysisResult = makeAnalysisResult({
        module: "static_analysis",
        vulnerabilities: [makeVuln({ location: "unknown.c:5" })],
      });
      const context: NormalizerContext = {
        analyzedFiles: [{ id: "file-1", filePath: "main.c" }],
      };

      normalizer.normalizeAnalysisResult(analysisResult, context);

      // Only analysis-result ref, no file ref
      expect(evidenceRefDAO.save).toHaveBeenCalledTimes(1);
      expect(vi.mocked(evidenceRefDAO.save).mock.calls[0][0].artifactType).toBe("analysis-result");
    });

    it("does NOT create file refs with legacy analyzedFileIds (prevents over-linking)", () => {
      const analysisResult = makeAnalysisResult({
        module: "static_analysis",
        vulnerabilities: [makeVuln({ location: "main.c:5" })],
      });
      const context: NormalizerContext = {
        analyzedFileIds: ["file-1", "file-2"],
        // no analyzedFiles — legacy fallback
      };

      normalizer.normalizeAnalysisResult(analysisResult, context);

      // Only analysis-result ref
      expect(evidenceRefDAO.save).toHaveBeenCalledTimes(1);
    });

    it("links dynamic session for dynamic_analysis", () => {
      const analysisResult = makeAnalysisResult({
        module: "dynamic_analysis",
        vulnerabilities: [makeVuln()],
      });
      const context: NormalizerContext = { sessionId: "sess-1" };

      normalizer.normalizeAnalysisResult(analysisResult, context);

      expect(evidenceRefDAO.save).toHaveBeenCalledTimes(2);
      const sessRef = vi.mocked(evidenceRefDAO.save).mock.calls[1][0];
      expect(sessRef.artifactId).toBe("sess-1");
      expect(sessRef.artifactType).toBe("dynamic-session");
      expect(sessRef.locatorType).toBe("timestamp-window");
    });

    it("links test result for dynamic_testing", () => {
      const analysisResult = makeAnalysisResult({
        module: "dynamic_testing",
        vulnerabilities: [makeVuln()],
      });
      const context: NormalizerContext = { testResultId: "test-1" };

      normalizer.normalizeAnalysisResult(analysisResult, context);

      expect(evidenceRefDAO.save).toHaveBeenCalledTimes(2);
      const testRef = vi.mocked(evidenceRefDAO.save).mock.calls[1][0];
      expect(testRef.artifactId).toBe("test-1");
      expect(testRef.artifactType).toBe("test-result");
      expect(testRef.locatorType).toBe("request-response-pair");
    });
  });

  describe("atomic transaction", () => {
    it("saves Run, Findings, and EvidenceRefs in a single transaction", () => {
      const analysisResult = makeAnalysisResult({
        vulnerabilities: [makeVuln(), makeVuln()],
      });

      normalizer.normalizeAnalysisResult(analysisResult);

      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(runDAO.save).toHaveBeenCalledTimes(1);
      expect(findingDAO.save).toHaveBeenCalledTimes(2);
      // 2 vulns × 1 evidence ref each (analysis-result only, no context)
      expect(evidenceRefDAO.save).toHaveBeenCalledTimes(2);
    });

    it("sets correct findingCount on run", () => {
      const analysisResult = makeAnalysisResult({
        vulnerabilities: [makeVuln(), makeVuln(), makeVuln()],
      });

      const run = normalizer.normalizeAnalysisResult(analysisResult);
      expect(run!.findingCount).toBe(3);
    });
  });

  describe("gate evaluation", () => {
    it("triggers gate evaluation after normalization", () => {
      const analysisResult = makeAnalysisResult({
        vulnerabilities: [makeVuln()],
      });

      const run = normalizer.normalizeAnalysisResult(analysisResult);
      expect(gateService.evaluateRun).toHaveBeenCalledWith(run!.id);
    });

    it("does not fail normalization if gate evaluation throws", () => {
      vi.mocked(gateService.evaluateRun).mockImplementation(() => {
        throw new Error("Gate boom");
      });

      const analysisResult = makeAnalysisResult({
        vulnerabilities: [makeVuln()],
      });

      const run = normalizer.normalizeAnalysisResult(analysisResult);
      expect(run).toBeDefined();
    });

    it("skips gate evaluation when gateService is not provided", () => {
      const normalizerNoGate = new ResultNormalizer(db, runDAO, findingDAO, evidenceRefDAO);

      const analysisResult = makeAnalysisResult({
        vulnerabilities: [makeVuln()],
      });

      const run = normalizerNoGate.normalizeAnalysisResult(analysisResult);
      expect(run).toBeDefined();
      expect(gateService.evaluateRun).not.toHaveBeenCalled();
    });
  });

  describe("timestamp handling", () => {
    it("uses context.startedAt when provided, ensuring startedAt < endedAt", () => {
      const earlyTime = "2026-01-01T00:00:00.000Z";
      const analysisResult = makeAnalysisResult({
        vulnerabilities: [makeVuln()],
        createdAt: "2026-01-01T01:00:00.000Z",
      });

      const run = normalizer.normalizeAnalysisResult(analysisResult, { startedAt: earlyTime });
      expect(run).toBeDefined();
      expect(run!.startedAt).toBe(earlyTime);
      expect(new Date(run!.endedAt!).getTime()).toBeGreaterThan(new Date(run!.startedAt!).getTime());
    });

    it("falls back to result.createdAt when context.startedAt is not provided", () => {
      const createdAt = "2026-01-01T01:00:00.000Z";
      const analysisResult = makeAnalysisResult({
        vulnerabilities: [makeVuln()],
        createdAt,
      });

      const run = normalizer.normalizeAnalysisResult(analysisResult);
      expect(run).toBeDefined();
      expect(run!.startedAt).toBe(createdAt);
    });

    it("falls back to result.createdAt when context has no startedAt", () => {
      const createdAt = "2026-01-01T01:00:00.000Z";
      const analysisResult = makeAnalysisResult({
        vulnerabilities: [makeVuln()],
        createdAt,
      });

      const run = normalizer.normalizeAnalysisResult(analysisResult, { sessionId: "sess-1" });
      expect(run).toBeDefined();
      expect(run!.startedAt).toBe(createdAt);
    });
  });

  describe("error handling", () => {
    it("returns undefined on transaction error without throwing", () => {
      db.transaction.mockImplementation(() => {
        throw new Error("DB error");
      });

      const analysisResult = makeAnalysisResult({
        vulnerabilities: [makeVuln()],
      });

      const run = normalizer.normalizeAnalysisResult(analysisResult);
      expect(run).toBeUndefined();
    });
  });

  describe("file matching", () => {
    it("matches file by exact path", () => {
      const analysisResult = makeAnalysisResult({
        module: "static_analysis",
        vulnerabilities: [makeVuln({ location: "src/main.c:10" })],
      });
      const context: NormalizerContext = {
        analyzedFiles: [
          { id: "file-1", filePath: "src/main.c" },
          { id: "file-2", filePath: "src/util.c" },
        ],
      };

      normalizer.normalizeAnalysisResult(analysisResult, context);

      const fileRef = vi.mocked(evidenceRefDAO.save).mock.calls[1][0];
      expect(fileRef.artifactId).toBe("file-1");
    });

    it("matches file by suffix path", () => {
      const analysisResult = makeAnalysisResult({
        module: "static_analysis",
        vulnerabilities: [makeVuln({ location: "/project/src/main.c:10" })],
      });
      const context: NormalizerContext = {
        analyzedFiles: [{ id: "file-1", filePath: "src/main.c" }],
      };

      normalizer.normalizeAnalysisResult(analysisResult, context);

      expect(evidenceRefDAO.save).toHaveBeenCalledTimes(2);
      const fileRef = vi.mocked(evidenceRefDAO.save).mock.calls[1][0];
      expect(fileRef.artifactId).toBe("file-1");
    });

    it("does not match when no location provided", () => {
      const analysisResult = makeAnalysisResult({
        module: "static_analysis",
        vulnerabilities: [makeVuln({ location: undefined })],
      });
      const context: NormalizerContext = {
        analyzedFiles: [{ id: "file-1", filePath: "main.c" }],
      };

      normalizer.normalizeAnalysisResult(analysisResult, context);

      // Only analysis-result ref
      expect(evidenceRefDAO.save).toHaveBeenCalledTimes(1);
    });
  });
});
