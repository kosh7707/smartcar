import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Database as DatabaseType } from "better-sqlite3";
import { createTestDb } from "../../test/test-db";
import { RunDAO } from "../../dao/run.dao";
import { FindingDAO } from "../../dao/finding.dao";
import { EvidenceRefDAO } from "../../dao/evidence-ref.dao";
import { GateResultDAO } from "../../dao/gate-result.dao";
import { ApprovalDAO } from "../../dao/approval.dao";
import { AuditLogDAO } from "../../dao/audit-log.dao";
import { AnalysisResultDAO } from "../../dao/analysis-result.dao";
import { FindingService } from "../../services/finding.service";
import { QualityGateService } from "../../services/quality-gate.service";
import { ApprovalService } from "../../services/approval.service";
import { ResultNormalizer } from "../../services/result-normalizer";
import { makeAnalysisResult, makeFinding, makeRun, makeEvidenceRef } from "../../test/factories";

describe("Service Integration Tests", () => {
  let db: DatabaseType;
  let runDAO: RunDAO;
  let findingDAO: FindingDAO;
  let evidenceRefDAO: EvidenceRefDAO;
  let gateResultDAO: GateResultDAO;
  let approvalDAO: ApprovalDAO;
  let auditLogDAO: AuditLogDAO;
  let analysisResultDAO: AnalysisResultDAO;

  let findingService: FindingService;
  let gateService: QualityGateService;
  let approvalService: ApprovalService;
  let normalizer: ResultNormalizer;

  beforeEach(() => {
    db = createTestDb();

    // DAOs
    runDAO = new RunDAO(db);
    findingDAO = new FindingDAO(db);
    evidenceRefDAO = new EvidenceRefDAO(db);
    gateResultDAO = new GateResultDAO(db);
    approvalDAO = new ApprovalDAO(db);
    auditLogDAO = new AuditLogDAO(db);
    analysisResultDAO = new AnalysisResultDAO(db);

    // Services
    findingService = new FindingService(findingDAO, evidenceRefDAO, auditLogDAO);
    gateService = new QualityGateService(findingDAO, evidenceRefDAO, gateResultDAO, runDAO);
    approvalService = new ApprovalService(approvalDAO, auditLogDAO, gateService);
    normalizer = new ResultNormalizer(db, runDAO, findingDAO, evidenceRefDAO, gateService);
  });

  afterEach(() => {
    db.close();
  });

  describe("ResultNormalizer → QualityGate full pipeline", () => {
    it("normalizes analysis result, creates run+findings+evidence, evaluates gate", () => {
      const analysisResult = makeAnalysisResult({
        id: "ar-1",
        projectId: "p1",
        module: "static_analysis",
        status: "completed",
        vulnerabilities: [
          {
            id: "v1",
            severity: "high",
            title: "Buffer Overflow",
            description: "Potential buffer overflow",
            source: "rule",
            location: "main.c:10",
          },
          {
            id: "v2",
            severity: "medium",
            title: "Uninitialized var",
            description: "Variable may be used uninitialized",
            source: "llm",
            location: "util.c:20",
          },
        ],
      });

      // Save analysis result first (referenced by Run)
      analysisResultDAO.save(analysisResult);

      // Normalize
      const run = normalizer.normalizeAnalysisResult(analysisResult);
      expect(run).toBeDefined();
      expect(run!.findingCount).toBe(2);

      // Verify findings were created
      const findings = findingDAO.findByRunId(run!.id);
      expect(findings).toHaveLength(2);

      // Rule source → open, LLM source → sandbox
      const ruleF = findings.find((f) => f.sourceType === "rule-engine");
      const llmF = findings.find((f) => f.sourceType === "llm-assist");
      expect(ruleF?.status).toBe("open");
      expect(ruleF?.confidence).toBe("high");
      expect(llmF?.status).toBe("sandbox");
      expect(llmF?.confidence).toBe("medium");

      // Evidence refs created
      const allRefs = [
        ...evidenceRefDAO.findByFindingId(ruleF!.id),
        ...evidenceRefDAO.findByFindingId(llmF!.id),
      ];
      expect(allRefs.length).toBeGreaterThanOrEqual(2); // at least analysis-result refs

      // Gate evaluated
      const gate = gateResultDAO.findByRunId(run!.id);
      expect(gate).toBeDefined();
      // sandbox finding → sandbox-unreviewed warning; no-evidence → warning
      expect(gate!.status).toBe("warning");
    });

    it("run.findingCount matches actual finding records in DB", () => {
      const analysisResult = makeAnalysisResult({
        id: "ar-count",
        projectId: "p1",
        module: "static_analysis",
        status: "completed",
        vulnerabilities: [
          { id: "v1", severity: "high", title: "A", description: "a", source: "rule", location: "a.c:1" },
          { id: "v2", severity: "medium", title: "B", description: "b", source: "llm", location: "b.c:2" },
          { id: "v3", severity: "low", title: "C", description: "c", source: "rule" },
        ],
      });

      analysisResultDAO.save(analysisResult);
      const run = normalizer.normalizeAnalysisResult(analysisResult);
      expect(run).toBeDefined();

      const actualFindings = findingDAO.findByRunId(run!.id);
      expect(run!.findingCount).toBe(actualFindings.length);
    });

    it("is idempotent — second call returns same run", () => {
      const analysisResult = makeAnalysisResult({
        id: "ar-2",
        projectId: "p1",
        status: "completed",
        vulnerabilities: [{ id: "v3", severity: "low", title: "Info", description: "", source: "rule" }],
      });
      analysisResultDAO.save(analysisResult);

      const run1 = normalizer.normalizeAnalysisResult(analysisResult);
      const run2 = normalizer.normalizeAnalysisResult(analysisResult);
      expect(run1!.id).toBe(run2!.id);
      // Only 1 finding created
      expect(findingDAO.findByRunId(run1!.id)).toHaveLength(1);
    });
  });

  describe("Finding status workflow", () => {
    it("open → needs_review → accepted_risk with audit trail", () => {
      const run = makeRun({ id: "run-1", projectId: "p1" });
      runDAO.save(run);

      const finding = makeFinding({ id: "f1", runId: "run-1", projectId: "p1", status: "open" });
      findingDAO.save(finding);

      // open → needs_review
      findingService.updateStatus("f1", "needs_review", "analyst", "needs further review");
      expect(findingDAO.findById("f1")?.status).toBe("needs_review");

      // needs_review → accepted_risk
      findingService.updateStatus("f1", "accepted_risk", "lead", "risk accepted per review");
      expect(findingDAO.findById("f1")?.status).toBe("accepted_risk");

      // Audit trail
      const detail = findingService.findById("f1");
      expect(detail?.auditLog).toHaveLength(2);
      expect(detail!.auditLog[0].action).toBe("finding.status_change");
    });
  });

  describe("Approval → Gate Override flow", () => {
    it("creates approval, approves it, gate becomes pass", () => {
      // Setup: run + critical finding → gate fails
      const run = makeRun({ id: "run-1", projectId: "p1" });
      runDAO.save(run);

      const criticalFinding = makeFinding({
        id: "f1",
        runId: "run-1",
        projectId: "p1",
        severity: "critical",
        status: "open",
      });
      findingDAO.save(criticalFinding);

      const gate = gateService.evaluateRun("run-1");
      expect(gate.status).toBe("fail");

      // Create approval for gate override
      const approval = approvalService.createRequest("gate.override", gate.id, "p1", "emergency override needed");
      expect(approval.status).toBe("pending");

      // Approve — should trigger gate override
      const decided = approvalService.decide(approval.id, "approved", "admin", "approved by lead");
      expect(decided.status).toBe("approved");

      // Gate should now have override
      const updatedGate = gateService.getById(gate.id);
      expect(updatedGate?.override).toBeDefined();
      expect(updatedGate?.override?.overriddenBy).toBe("admin");

      // Audit trail should exist
      const auditLogs = auditLogDAO.findByResourceId(approval.id);
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe("approval.approved");
    });

    it("rejected approval does NOT override gate", () => {
      const run = makeRun({ id: "run-2", projectId: "p1" });
      runDAO.save(run);

      const criticalFinding = makeFinding({
        id: "f2",
        runId: "run-2",
        projectId: "p1",
        severity: "critical",
        status: "open",
      });
      findingDAO.save(criticalFinding);

      const gate = gateService.evaluateRun("run-2");
      const approval = approvalService.createRequest("gate.override", gate.id, "p1", "want override");
      approvalService.decide(approval.id, "rejected", "admin", "not justified");

      const updatedGate = gateService.getById(gate.id);
      expect(updatedGate?.override).toBeUndefined();
    });
  });

  describe("Finding summary aggregation", () => {
    it("returns correct counts by status and severity", () => {
      const run = makeRun({ id: "run-1", projectId: "p1" });
      runDAO.save(run);

      findingDAO.save(makeFinding({ runId: "run-1", projectId: "p1", severity: "high", status: "open" }));
      findingDAO.save(makeFinding({ runId: "run-1", projectId: "p1", severity: "high", status: "open" }));
      findingDAO.save(makeFinding({ runId: "run-1", projectId: "p1", severity: "critical", status: "sandbox" }));
      findingDAO.save(makeFinding({ runId: "run-1", projectId: "p1", severity: "medium", status: "fixed" }));

      const summary = findingService.getSummary("p1");
      expect(summary.total).toBe(4);
      expect(summary.bySeverity.high).toBe(2);
      expect(summary.bySeverity.critical).toBe(1);
      expect(summary.byStatus.open).toBe(2);
      expect(summary.byStatus.sandbox).toBe(1);
      expect(summary.byStatus.fixed).toBe(1);
    });
  });
});
