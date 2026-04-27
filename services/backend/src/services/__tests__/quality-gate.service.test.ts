import { describe, it, expect, vi, beforeEach } from "vitest";
import { QualityGateService } from "../quality-gate.service";
import type { IFindingDAO, IEvidenceRefDAO, IGateResultDAO, IRunDAO } from "../../dao/interfaces";
import { makeFinding, makeRun, makeGateResult } from "../../test/factories";
import { NotFoundError } from "../../lib/errors";
import type { Finding, GateResult } from "@aegis/shared";
import type { ProjectSettingsService } from "../project-settings.service";

function createMockFindingDAO(): IFindingDAO {
  return {
    save: vi.fn(),
    saveMany: vi.fn(),
    findById: vi.fn(),
    findByRunId: vi.fn().mockReturnValue([]),
    findByProjectId: vi.fn(),
    findByIds: vi.fn().mockReturnValue([]),
    findByFingerprint: vi.fn(),
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

function createMockGateResultDAO(): IGateResultDAO {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByRunId: vi.fn().mockReturnValue(undefined),
    findByProjectId: vi.fn().mockReturnValue([]),
    updateOverride: vi.fn(),
    statsByProject: vi.fn(),
    latestByProjectId: vi.fn().mockReturnValue(undefined),
  };
}

function createMockRunDAO(): IRunDAO {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByProjectId: vi.fn(),
    findByAnalysisResultId: vi.fn(),
    updateFindingCount: vi.fn(),
    trendByModule: vi.fn(),
    findLatestCompletedRuns: vi.fn().mockReturnValue([]),
  };
}

describe("QualityGateService", () => {
  let service: QualityGateService;
  let findingDAO: IFindingDAO;
  let evidenceRefDAO: IEvidenceRefDAO;
  let gateResultDAO: IGateResultDAO;
  let runDAO: IRunDAO;

  beforeEach(() => {
    findingDAO = createMockFindingDAO();
    evidenceRefDAO = createMockEvidenceRefDAO();
    gateResultDAO = createMockGateResultDAO();
    runDAO = createMockRunDAO();
    service = new QualityGateService(findingDAO, evidenceRefDAO, gateResultDAO, runDAO);
  });

  describe("evaluateRun", () => {
    it("returns existing result if already evaluated (idempotent)", () => {
      const existing = makeGateResult({ runId: "run-1" });
      vi.mocked(gateResultDAO.findByRunId).mockReturnValue(existing);

      const result = service.evaluateRun("run-1");
      expect(result).toBe(existing);
      expect(gateResultDAO.save).not.toHaveBeenCalled();
    });

    it("throws NotFoundError if run does not exist", () => {
      vi.mocked(gateResultDAO.findByRunId).mockReturnValue(undefined);
      vi.mocked(runDAO.findById).mockReturnValue(undefined);

      expect(() => service.evaluateRun("no-such-run")).toThrow(NotFoundError);
    });

    it("passes with no findings", () => {
      const run = makeRun({ id: "run-1", projectId: "proj-1" });
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue([]);

      const result = service.evaluateRun("run-1");
      expect(result.status).toBe("pass");
      expect(result.rules).toHaveLength(4);
      expect(result.profileId).toBe("default");
      expect(result.requestedBy).toBe("system");
      expect(result.rules.every((r) => r.result === "passed")).toBe(true);
      expect(result.rules.find((r) => r.ruleId === "no-critical")).toMatchObject({ current: 0, threshold: 0, unit: "count" });
      expect(result.rules.find((r) => r.ruleId === "evidence-coverage")).toMatchObject({ current: 100, threshold: 100, unit: "percent" });
      expect(gateResultDAO.save).toHaveBeenCalledTimes(1);
    });

    // ── no-critical rule ──

    it("fails when active critical finding exists", () => {
      const run = makeRun({ id: "run-1", projectId: "proj-1" });
      const critical = makeFinding({ severity: "critical", status: "open" });
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue([critical]);

      const result = service.evaluateRun("run-1");
      expect(result.status).toBe("fail");
      const noCritical = result.rules.find((r) => r.ruleId === "no-critical");
      expect(noCritical?.result).toBe("failed");
      expect(noCritical?.linkedFindingIds).toContain(critical.id);
    });

    it("excludes sandbox/false_positive/accepted_risk from critical check", () => {
      const run = makeRun({ id: "run-1", projectId: "proj-1" });
      const excluded: Finding[] = [
        makeFinding({ severity: "critical", status: "sandbox" }),
        makeFinding({ severity: "critical", status: "false_positive" }),
        makeFinding({ severity: "critical", status: "accepted_risk" }),
      ];
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue(excluded);

      const result = service.evaluateRun("run-1");
      const noCritical = result.rules.find((r) => r.ruleId === "no-critical");
      expect(noCritical?.result).toBe("passed");
    });

    // ── high-threshold rule ──

    it("warns when ≥5 active high findings exist", () => {
      const run = makeRun({ id: "run-1", projectId: "proj-1" });
      const highFindings = Array.from({ length: 5 }, () =>
        makeFinding({ severity: "high", status: "open" })
      );
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue(highFindings);

      const result = service.evaluateRun("run-1");
      expect(result.status).toBe("warning");
      const highThreshold = result.rules.find((r) => r.ruleId === "high-threshold");
      expect(highThreshold?.result).toBe("warning");
      expect(highThreshold?.linkedFindingIds).toHaveLength(5);
      expect(highThreshold).toMatchObject({ current: 5, threshold: 5, unit: "count" });
      expect(highThreshold?.meta).toMatchObject({ current: 5, threshold: 5, unit: "count" });
    });

    it("passes when <5 active high findings", () => {
      const run = makeRun({ id: "run-1", projectId: "proj-1" });
      const highFindings = Array.from({ length: 4 }, () =>
        makeFinding({ severity: "high", status: "open" })
      );
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue(highFindings);

      const result = service.evaluateRun("run-1");
      const highThreshold = result.rules.find((r) => r.ruleId === "high-threshold");
      expect(highThreshold?.result).toBe("passed");
      expect(highThreshold?.linkedFindingIds).toHaveLength(0);
    });

    // ── evidence-coverage rule ──

    it("warns when active finding has no evidence", () => {
      const run = makeRun({ id: "run-1", projectId: "proj-1" });
      const finding = makeFinding({ status: "open" });
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue([finding]);
      vi.mocked(evidenceRefDAO.findByFindingId).mockReturnValue([]);

      const result = service.evaluateRun("run-1");
      const evCov = result.rules.find((r) => r.ruleId === "evidence-coverage");
      expect(evCov?.result).toBe("warning");
      expect(evCov?.linkedFindingIds).toContain(finding.id);
      expect(evCov).toMatchObject({ current: 0, threshold: 100, unit: "percent" });
    });

    it("passes evidence-coverage when all active findings have evidence", () => {
      const run = makeRun({ id: "run-1", projectId: "proj-1" });
      const finding = makeFinding({ status: "open", id: "f-1" });
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue([finding]);
      vi.mocked(evidenceRefDAO.findByFindingId).mockReturnValue([{ id: "evr-1" } as any]);

      const result = service.evaluateRun("run-1");
      const evCov = result.rules.find((r) => r.ruleId === "evidence-coverage");
      expect(evCov?.result).toBe("passed");
    });

    it("skips excluded statuses in evidence-coverage", () => {
      const run = makeRun({ id: "run-1", projectId: "proj-1" });
      const finding = makeFinding({ status: "false_positive" });
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue([finding]);

      const result = service.evaluateRun("run-1");
      const evCov = result.rules.find((r) => r.ruleId === "evidence-coverage");
      expect(evCov?.result).toBe("passed");
      // findByFindingId should not be called for excluded statuses
      expect(evidenceRefDAO.findByFindingId).not.toHaveBeenCalled();
    });

    // ── sandbox-unreviewed rule ──

    it("warns when sandbox findings exist", () => {
      const run = makeRun({ id: "run-1", projectId: "proj-1" });
      const sandbox = makeFinding({ status: "sandbox" });
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue([sandbox]);

      const result = service.evaluateRun("run-1");
      const sbx = result.rules.find((r) => r.ruleId === "sandbox-unreviewed");
      expect(sbx?.result).toBe("warning");
      expect(sbx?.linkedFindingIds).toContain(sandbox.id);
    });

    // ── status derivation ──

    it("fail takes precedence over warning", () => {
      const run = makeRun({ id: "run-1", projectId: "proj-1" });
      // critical (fail) + sandbox (warning)
      const findings: Finding[] = [
        makeFinding({ severity: "critical", status: "open" }),
        makeFinding({ status: "sandbox" }),
      ];
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue(findings);

      const result = service.evaluateRun("run-1");
      expect(result.status).toBe("fail");
    });
  });

  describe("applyOverride", () => {
    it("applies override and returns updated gate result", () => {
      const gate = makeGateResult({ id: "gate-1", status: "fail" });
      vi.mocked(gateResultDAO.findById).mockReturnValue(gate);

      const result = service.applyOverride("gate-1", "admin", "approved by lead", "approval-1");
      expect(result.status).toBe("pass");
      expect(result.override).toBeDefined();
      expect(result.override!.overriddenBy).toBe("admin");
      expect(result.override!.approvalId).toBe("approval-1");
      expect(gateResultDAO.updateOverride).toHaveBeenCalledTimes(1);
    });

    it("throws NotFoundError for nonexistent gate", () => {
      vi.mocked(gateResultDAO.findById).mockReturnValue(undefined);
      expect(() =>
        service.applyOverride("no-such", "admin", "reason", "approval-1")
      ).toThrow(NotFoundError);
    });
  });

  describe("Gate Profile variants", () => {
    function createMockSettingsService(gateProfileId?: string): ProjectSettingsService {
      return {
        getAll: vi.fn().mockReturnValue({ gateProfileId }),
      } as any;
    }

    it("uses default profile when settingsService is absent", () => {
      // service was created without settingsService in beforeEach
      const run = makeRun({ id: "run-p1", projectId: "proj-1" });
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue([]);

      const result = service.evaluateRun("run-p1");
      expect(result.rules).toHaveLength(4);
    });

    it("strict profile uses threshold 3 for high findings", () => {
      const settingsSvc = createMockSettingsService("strict");
      const profileService = new QualityGateService(findingDAO, evidenceRefDAO, gateResultDAO, runDAO, settingsSvc);

      const run = makeRun({ id: "run-p2", projectId: "proj-1" });
      const highFindings = Array.from({ length: 3 }, () =>
        makeFinding({ severity: "high", status: "open" }),
      );
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue(highFindings);

      const result = profileService.evaluateRun("run-p2");
      const highRule = result.rules.find(r => r.ruleId === "high-threshold");
      expect(highRule?.result).toBe("warning");
      expect(highRule?.linkedFindingIds).toHaveLength(3);
    });

    it("relaxed profile only evaluates no-critical rule", () => {
      const settingsSvc = createMockSettingsService("relaxed");
      const profileService = new QualityGateService(findingDAO, evidenceRefDAO, gateResultDAO, runDAO, settingsSvc);

      const run = makeRun({ id: "run-p3", projectId: "proj-1" });
      const highFindings = Array.from({ length: 10 }, () =>
        makeFinding({ severity: "high", status: "open" }),
      );
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue(highFindings);

      const result = profileService.evaluateRun("run-p3");
      // relaxed: only no-critical enabled
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].ruleId).toBe("no-critical");
      expect(result.status).toBe("pass"); // no critical findings
    });

    it("falls back to default for unknown profileId", () => {
      const settingsSvc = createMockSettingsService("nonexistent-profile");
      const profileService = new QualityGateService(findingDAO, evidenceRefDAO, gateResultDAO, runDAO, settingsSvc);

      const run = makeRun({ id: "run-p4", projectId: "proj-1" });
      vi.mocked(runDAO.findById).mockReturnValue(run);
      vi.mocked(findingDAO.findByRunId).mockReturnValue([]);

      const result = profileService.evaluateRun("run-p4");
      expect(result.rules).toHaveLength(4); // default has 4 rules
    });
  });
});
