import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Database as DatabaseType } from "better-sqlite3";
import { createTestDb } from "../../test/test-db";
import { ProjectDAO } from "../../dao/project.dao";
import { RunDAO } from "../../dao/run.dao";
import { FindingDAO } from "../../dao/finding.dao";
import { EvidenceRefDAO } from "../../dao/evidence-ref.dao";
import { GateResultDAO } from "../../dao/gate-result.dao";
import { ApprovalDAO } from "../../dao/approval.dao";
import { AuditLogDAO } from "../../dao/audit-log.dao";
import { AnalysisResultDAO } from "../../dao/analysis-result.dao";
import { FileStore } from "../../dao/file-store";
import { AdapterDAO } from "../../dao/adapter.dao";
import { ProjectSettingsDAO } from "../../dao/project-settings.dao";
import { BuildTargetDAO } from "../../dao/build-target.dao";
import { NotificationDAO } from "../../dao/notification.dao";
import { UserDAO, SessionDAO } from "../../dao/user.dao";
import {
  makeProject,
  makeRun,
  makeFinding,
  makeEvidenceRef,
  makeGateResult,
  makeApproval,
  makeAuditLog,
  makeAnalysisResult,
  makeStoredFile,
  makeBuildTarget,
  makeNotification,
} from "../../test/factories";

describe("DAO Integration Tests", () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  describe("ProjectDAO", () => {
    it("save → findById → findAll → update → delete", () => {
      const dao = new ProjectDAO(db);
      const project = makeProject({ id: "p1", name: "Test" });

      dao.save(project);
      expect(dao.findById("p1")).toMatchObject({ id: "p1", name: "Test" });
      expect(dao.findAll()).toHaveLength(1);

      const updated = dao.update("p1", { name: "Updated" });
      expect(updated?.name).toBe("Updated");

      expect(dao.delete("p1")).toBe(true);
      expect(dao.findById("p1")).toBeUndefined();
      expect(dao.delete("p1")).toBe(false);
    });
  });

  describe("RunDAO + FindingDAO + EvidenceRefDAO (core domain)", () => {
    it("full lifecycle: run → findings → evidence refs", () => {
      const runDao = new RunDAO(db);
      const findingDao = new FindingDAO(db);
      const evidenceRefDao = new EvidenceRefDAO(db);

      const run = makeRun({ id: "run-1", projectId: "p1" });
      runDao.save(run);
      expect(runDao.findById("run-1")).toMatchObject({ id: "run-1" });

      const f1 = makeFinding({ id: "f1", runId: "run-1", projectId: "p1", severity: "high", status: "open" });
      const f2 = makeFinding({ id: "f2", runId: "run-1", projectId: "p1", severity: "critical", status: "sandbox" });
      findingDao.save(f1);
      findingDao.save(f2);

      expect(findingDao.findByRunId("run-1")).toHaveLength(2);
      expect(findingDao.findByProjectId("p1")).toHaveLength(2);

      // filter by status
      expect(findingDao.findByProjectId("p1", { status: "open" })).toHaveLength(1);
      expect(findingDao.findByProjectId("p1", { severity: "critical" })).toHaveLength(1);

      // status update
      findingDao.updateStatus("f2", "needs_review");
      expect(findingDao.findById("f2")?.status).toBe("needs_review");

      // evidence refs
      const ref1 = makeEvidenceRef({ id: "evr-1", findingId: "f1", artifactId: run.analysisResultId });
      evidenceRefDao.save(ref1);
      expect(evidenceRefDao.findByFindingId("f1")).toHaveLength(1);

      // batch lookup
      const map = evidenceRefDao.findByFindingIds(["f1", "f2"]);
      expect(map.get("f1")).toHaveLength(1);
      expect(map.get("f2") ?? []).toHaveLength(0);

      // summary
      const summary = findingDao.summaryByProjectId("p1");
      expect(summary.total).toBe(2);
    });
  });

  describe("GateResultDAO", () => {
    it("save → findByRunId → updateOverride", () => {
      const dao = new GateResultDAO(db);
      const gate = makeGateResult({ id: "g1", runId: "run-1", projectId: "p1", status: "fail" });

      dao.save(gate);
      expect(dao.findByRunId("run-1")).toMatchObject({ id: "g1", status: "fail" });
      expect(dao.findByProjectId("p1")).toHaveLength(1);

      const override = { overriddenBy: "admin", reason: "ok", approvalId: "ap-1", overriddenAt: new Date().toISOString() };
      dao.updateOverride("g1", override);
      const updated = dao.findById("g1")!;
      expect(updated.override).toMatchObject({ overriddenBy: "admin" });
    });
  });

  describe("ApprovalDAO", () => {
    it("save → findPending → updateStatus", () => {
      const dao = new ApprovalDAO(db);
      const approval = makeApproval({ id: "ap-1", projectId: "p1", status: "pending" });

      dao.save(approval);
      expect(dao.findPending()).toHaveLength(1);
      expect(dao.findByProjectId("p1")).toHaveLength(1);
      expect(dao.findByProjectId("p1", "pending")).toHaveLength(1);

      const decision = { decidedBy: "admin", decidedAt: new Date().toISOString(), comment: "ok" };
      dao.updateStatus("ap-1", "approved", decision);
      expect(dao.findById("ap-1")?.status).toBe("approved");
      expect(dao.findPending()).toHaveLength(0);
    });
  });

  describe("AuditLogDAO", () => {
    it("save → findByResourceId → findByResourceIds", () => {
      const dao = new AuditLogDAO(db);
      const log1 = makeAuditLog({ id: "log-1", resourceId: "f1" });
      const log2 = makeAuditLog({ id: "log-2", resourceId: "f1" });
      const log3 = makeAuditLog({ id: "log-3", resourceId: "f2" });

      dao.save(log1);
      dao.save(log2);
      dao.save(log3);

      expect(dao.findByResourceId("f1")).toHaveLength(2);
      const byIds = dao.findByResourceIds(["f1", "f2"]);
      expect(byIds).toHaveLength(3);
    });
  });

  describe("AnalysisResultDAO", () => {
    it("save → findByProjectId → deleteById", () => {
      const dao = new AnalysisResultDAO(db);
      const result = makeAnalysisResult({ id: "ar-1", projectId: "p1" });

      dao.save(result);
      expect(dao.findByProjectId("p1")).toHaveLength(1);
      expect(dao.findById("ar-1")).toBeDefined();

      expect(dao.deleteById("ar-1")).toBe(true);
      expect(dao.findById("ar-1")).toBeUndefined();
    });
  });

  describe("FileStore", () => {
    it("save → findById → findByProjectId → delete", () => {
      const store = new FileStore(db);
      const file = makeStoredFile({ id: "file-1", projectId: "p1" });

      store.save(file);
      const found = store.findById("file-1");
      expect(found).toBeDefined();
      expect(found!.name).toBe(file.name);

      expect(store.findByProjectId("p1")).toHaveLength(1);
      expect(store.countByProjectId("p1")).toBe(1);

      store.delete("file-1");
      expect(store.findById("file-1")).toBeUndefined();
    });
  });

  describe("AdapterDAO", () => {
    it("save → findByProjectId → update → delete", () => {
      const dao = new AdapterDAO(db);
      const adapter = { id: "a1", name: "Test", url: "ws://localhost:1234", projectId: "p1", createdAt: new Date().toISOString() };

      dao.save(adapter);
      expect(dao.findByProjectId("p1")).toHaveLength(1);

      expect(dao.update("a1", { name: "Renamed" })).toBe(true);
      expect(dao.findById("a1")?.name).toBe("Renamed");

      expect(dao.delete("a1")).toBe(true);
      expect(dao.findById("a1")).toBeUndefined();
    });
  });

  describe("ProjectSettingsDAO", () => {
    it("set → get → getAll → deleteKey → deleteByProjectId", () => {
      const dao = new ProjectSettingsDAO(db);

      dao.set("p1", "llmUrl", "http://llm.local");
      dao.set("p1", "theme", "dark");

      expect(dao.get("p1", "llmUrl")).toBe("http://llm.local");
      expect(dao.getAll("p1")).toEqual({ llmUrl: "http://llm.local", theme: "dark" });

      dao.deleteKey("p1", "theme");
      expect(dao.get("p1", "theme")).toBeUndefined();

      dao.deleteByProjectId("p1");
      expect(dao.getAll("p1")).toEqual({});
    });

    it("upsert overwrites existing value", () => {
      const dao = new ProjectSettingsDAO(db);
      dao.set("p1", "key", "v1");
      dao.set("p1", "key", "v2");
      expect(dao.get("p1", "key")).toBe("v2");
    });
  });

  describe("BuildTargetDAO", () => {
    it("CRUD lifecycle", () => {
      const dao = new BuildTargetDAO(db);
      const target = makeBuildTarget({ id: "t1", projectId: "p1", name: "gateway" });
      dao.save(target);

      const found = dao.findById("t1");
      expect(found).toBeDefined();
      expect(found!.name).toBe("gateway");
      expect(found!.buildProfile).toMatchObject({ sdkId: "linux-x86_64-c" });

      const byProject = dao.findByProjectId("p1");
      expect(byProject).toHaveLength(1);

      const updated = dao.update("t1", { name: "renamed" });
      expect(updated!.name).toBe("renamed");

      expect(dao.delete("t1")).toBe(true);
      expect(dao.findById("t1")).toBeUndefined();
    });

    it("deleteByProjectId removes all targets", () => {
      const dao = new BuildTargetDAO(db);
      dao.save(makeBuildTarget({ id: "t1", projectId: "p1" }));
      dao.save(makeBuildTarget({ id: "t2", projectId: "p1" }));
      dao.save(makeBuildTarget({ id: "t3", projectId: "p2" }));

      expect(dao.deleteByProjectId("p1")).toBe(2);
      expect(dao.findByProjectId("p1")).toHaveLength(0);
      expect(dao.findByProjectId("p2")).toHaveLength(1);
    });
  });

  // ================================================================
  // FindingDAO — 확장 기능 (S1 WR 대응)
  // ================================================================

  describe("FindingDAO — findByIds", () => {
    it("returns findings matching given IDs", () => {
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);
      runDao.save(makeRun({ id: "run-ids", projectId: "p1" }));

      findingDao.save(makeFinding({ id: "f1", runId: "run-ids", projectId: "p1" }));
      findingDao.save(makeFinding({ id: "f2", runId: "run-ids", projectId: "p1" }));
      findingDao.save(makeFinding({ id: "f3", runId: "run-ids", projectId: "p1" }));

      const result = findingDao.findByIds(["f1", "f3"]);
      expect(result).toHaveLength(2);
      expect(result.map((f) => f.id).sort()).toEqual(["f1", "f3"]);
    });

    it("returns empty array for empty input", () => {
      const findingDao = new FindingDAO(db);
      expect(findingDao.findByIds([])).toEqual([]);
    });

    it("skips nonexistent IDs", () => {
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);
      runDao.save(makeRun({ id: "run-skip", projectId: "p1" }));
      findingDao.save(makeFinding({ id: "f-exist", runId: "run-skip", projectId: "p1" }));

      const result = findingDao.findByIds(["f-exist", "f-ghost"]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("f-exist");
    });
  });

  describe("FindingDAO — findAllByFingerprint", () => {
    it("returns all findings with same fingerprint in project", () => {
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);
      runDao.save(makeRun({ id: "run-fp1", projectId: "p1" }));
      runDao.save(makeRun({ id: "run-fp2", projectId: "p1" }));

      findingDao.save(makeFinding({ id: "f-a", runId: "run-fp1", projectId: "p1", fingerprint: "fp-same" }));
      findingDao.save(makeFinding({ id: "f-b", runId: "run-fp2", projectId: "p1", fingerprint: "fp-same" }));
      findingDao.save(makeFinding({ id: "f-c", runId: "run-fp1", projectId: "p1", fingerprint: "fp-other" }));

      const result = findingDao.findAllByFingerprint("p1", "fp-same");
      expect(result).toHaveLength(2);
      expect(result.map((f) => f.id).sort()).toEqual(["f-a", "f-b"]);
    });

    it("does not return findings from other projects", () => {
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);
      runDao.save(makeRun({ id: "run-x", projectId: "p1" }));
      runDao.save(makeRun({ id: "run-y", projectId: "p2" }));

      findingDao.save(makeFinding({ id: "f-p1", runId: "run-x", projectId: "p1", fingerprint: "fp-shared" }));
      findingDao.save(makeFinding({ id: "f-p2", runId: "run-y", projectId: "p2", fingerprint: "fp-shared" }));

      const result = findingDao.findAllByFingerprint("p1", "fp-shared");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("f-p1");
    });
  });

  describe("FindingDAO — withTransaction", () => {
    it("commits on success", () => {
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);
      runDao.save(makeRun({ id: "run-tx", projectId: "p1" }));

      findingDao.withTransaction(() => {
        findingDao.save(makeFinding({ id: "f-tx1", runId: "run-tx", projectId: "p1" }));
        findingDao.save(makeFinding({ id: "f-tx2", runId: "run-tx", projectId: "p1" }));
      });

      expect(findingDao.findByProjectId("p1")).toHaveLength(2);
    });

    it("rolls back on error", () => {
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);
      runDao.save(makeRun({ id: "run-tx2", projectId: "p1" }));

      expect(() => {
        findingDao.withTransaction(() => {
          findingDao.save(makeFinding({ id: "f-tx-ok", runId: "run-tx2", projectId: "p1" }));
          throw new Error("rollback test");
        });
      }).toThrow("rollback test");

      expect(findingDao.findByProjectId("p1")).toHaveLength(0);
    });
  });

  describe("FindingDAO — extended filters (q, sort, order, sourceType)", () => {
    it("filters by text search (q)", () => {
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);
      runDao.save(makeRun({ id: "run-q", projectId: "p1" }));

      findingDao.save(makeFinding({ id: "f-q1", runId: "run-q", projectId: "p1", title: "Buffer overflow in main.c" }));
      findingDao.save(makeFinding({ id: "f-q2", runId: "run-q", projectId: "p1", title: "SQL injection" }));

      const result = findingDao.findByProjectId("p1", { q: "Buffer" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("f-q1");
    });

    it("filters by sourceType", () => {
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);
      runDao.save(makeRun({ id: "run-st", projectId: "p1" }));

      findingDao.save(makeFinding({ id: "f-st1", runId: "run-st", projectId: "p1", sourceType: "agent" }));
      findingDao.save(makeFinding({ id: "f-st2", runId: "run-st", projectId: "p1", sourceType: "sast-tool" }));

      const result = findingDao.findByProjectId("p1", { sourceType: "agent" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("f-st1");
    });

    it("sorts by severity", () => {
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);
      runDao.save(makeRun({ id: "run-sort", projectId: "p1" }));

      findingDao.save(makeFinding({ id: "f-low", runId: "run-sort", projectId: "p1", severity: "low" }));
      findingDao.save(makeFinding({ id: "f-crit", runId: "run-sort", projectId: "p1", severity: "critical" }));
      findingDao.save(makeFinding({ id: "f-med", runId: "run-sort", projectId: "p1", severity: "medium" }));

      const result = findingDao.findByProjectId("p1", { sort: "severity", order: "asc" });
      expect(result[0].severity).toBe("critical");
      expect(result[1].severity).toBe("medium");
      expect(result[2].severity).toBe("low");
    });

    it("sorts by createdAt desc", () => {
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);
      runDao.save(makeRun({ id: "run-srt2", projectId: "p1" }));

      findingDao.save(makeFinding({ id: "f-old", runId: "run-srt2", projectId: "p1", createdAt: "2026-03-20T00:00:00Z" }));
      findingDao.save(makeFinding({ id: "f-new", runId: "run-srt2", projectId: "p1", createdAt: "2026-03-25T00:00:00Z" }));

      const result = findingDao.findByProjectId("p1", { sort: "createdAt", order: "desc" });
      expect(result[0].id).toBe("f-new");
      expect(result[1].id).toBe("f-old");
    });

    it("combines q + sourceType + sort", () => {
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);
      runDao.save(makeRun({ id: "run-combo", projectId: "p1" }));

      findingDao.save(makeFinding({ id: "f-c1", runId: "run-combo", projectId: "p1", title: "heap overflow", sourceType: "agent", severity: "high" }));
      findingDao.save(makeFinding({ id: "f-c2", runId: "run-combo", projectId: "p1", title: "heap buffer read", sourceType: "agent", severity: "critical" }));
      findingDao.save(makeFinding({ id: "f-c3", runId: "run-combo", projectId: "p1", title: "heap spray", sourceType: "sast-tool", severity: "medium" }));

      const result = findingDao.findByProjectId("p1", { q: "heap", sourceType: "agent", sort: "severity", order: "asc" });
      expect(result).toHaveLength(2);
      expect(result[0].severity).toBe("critical");
      expect(result[1].severity).toBe("high");
    });
  });

  // ================================================================
  // AuditLogDAO — 신규 메서드
  // ================================================================

  describe("AuditLogDAO — findFindingStatusChanges", () => {
    it("returns status change logs for findings in given project", () => {
      const auditLogDao = new AuditLogDAO(db);
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);

      runDao.save(makeRun({ id: "run-al", projectId: "p1" }));
      findingDao.save(makeFinding({ id: "f-al", runId: "run-al", projectId: "p1" }));

      auditLogDao.save(makeAuditLog({
        id: "al-1", action: "finding.status_change", resource: "finding", resourceId: "f-al",
        detail: { from: "open", to: "fixed" }, timestamp: "2026-03-26T10:00:00Z",
      }));
      auditLogDao.save(makeAuditLog({
        id: "al-2", action: "other.action", resource: "finding", resourceId: "f-al",
      }));

      const result = auditLogDao.findFindingStatusChanges("p1", 10);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("al-1");
    });

    it("does not return findings from other projects", () => {
      const auditLogDao = new AuditLogDAO(db);
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);

      runDao.save(makeRun({ id: "run-p2", projectId: "p2" }));
      findingDao.save(makeFinding({ id: "f-p2", runId: "run-p2", projectId: "p2" }));
      auditLogDao.save(makeAuditLog({
        id: "al-p2", action: "finding.status_change", resource: "finding", resourceId: "f-p2",
      }));

      const result = auditLogDao.findFindingStatusChanges("p1", 10);
      expect(result).toHaveLength(0);
    });

    it("respects limit parameter", () => {
      const auditLogDao = new AuditLogDAO(db);
      const findingDao = new FindingDAO(db);
      const runDao = new RunDAO(db);

      runDao.save(makeRun({ id: "run-lim", projectId: "p1" }));
      findingDao.save(makeFinding({ id: "f-lim", runId: "run-lim", projectId: "p1" }));

      for (let i = 0; i < 5; i++) {
        auditLogDao.save(makeAuditLog({
          id: `al-lim-${i}`, action: "finding.status_change", resource: "finding", resourceId: "f-lim",
        }));
      }

      expect(auditLogDao.findFindingStatusChanges("p1", 3)).toHaveLength(3);
    });
  });

  describe("AuditLogDAO — findApprovalDecisions", () => {
    it("returns approval logs for given project", () => {
      const auditLogDao = new AuditLogDAO(db);
      const approvalDao = new ApprovalDAO(db);

      approvalDao.save(makeApproval({ id: "ap-test", projectId: "p1" }));
      auditLogDao.save(makeAuditLog({
        id: "al-ap", action: "approval.approved", resource: "approval", resourceId: "ap-test",
        detail: { decision: "approved" },
      }));

      const result = auditLogDao.findApprovalDecisions("p1", 10);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("al-ap");
    });

    it("does not return approvals from other projects", () => {
      const auditLogDao = new AuditLogDAO(db);
      const approvalDao = new ApprovalDAO(db);

      approvalDao.save(makeApproval({ id: "ap-other", projectId: "p-other" }));
      auditLogDao.save(makeAuditLog({
        id: "al-other", action: "approval.rejected", resource: "approval", resourceId: "ap-other",
      }));

      expect(auditLogDao.findApprovalDecisions("p1", 10)).toHaveLength(0);
    });
  });

  describe("AnalysisResultDAO — new fields", () => {
    it("persists and retrieves agent metadata", () => {
      const dao = new AnalysisResultDAO(db);

      const result = makeAnalysisResult({
        id: "deep-1",
        module: "deep_analysis",
        caveats: ["Test caveat"],
        confidenceScore: 0.865,
        confidenceBreakdown: { grounding: 0.95, deterministicSupport: 1.0, ragCoverage: 0.4, schemaCompliance: 1.0 },
        needsHumanReview: true,
        recommendedNextSteps: ["Step 1", "Step 2"],
        policyFlags: ["CWE-78"],
        scaLibraries: [{ name: "openssl", version: "1.1.1", path: "libs/openssl" }],
        agentAudit: { latencyMs: 12000, tokenUsage: { prompt: 3000, completion: 1500 }, turnCount: 2, toolCallCount: 3, terminationReason: "content_returned" },
      });

      dao.save(result);
      const loaded = dao.findById("deep-1")!;

      expect(loaded.caveats).toEqual(["Test caveat"]);
      expect(loaded.confidenceScore).toBe(0.865);
      expect(loaded.confidenceBreakdown).toMatchObject({ grounding: 0.95 });
      expect(loaded.needsHumanReview).toBe(true);
      expect(loaded.recommendedNextSteps).toEqual(["Step 1", "Step 2"]);
      expect(loaded.policyFlags).toEqual(["CWE-78"]);
      expect(loaded.scaLibraries).toHaveLength(1);
      expect(loaded.scaLibraries![0].name).toBe("openssl");
      expect(loaded.agentAudit).toMatchObject({ latencyMs: 12000, turnCount: 2 });
    });

    it("omits empty arrays in response", () => {
      const dao = new AnalysisResultDAO(db);

      const result = makeAnalysisResult({ id: "basic-1" });
      dao.save(result);
      const loaded = dao.findById("basic-1")!;

      expect(loaded.caveats).toBeUndefined();
      expect(loaded.confidenceScore).toBeUndefined();
      expect(loaded.agentAudit).toBeUndefined();
    });
  });

  describe("NotificationDAO", () => {
    it("save → findByProjectId → unreadCount → markAsRead → markAllAsRead", () => {
      const dao = new NotificationDAO(db);
      const pid = "proj-notif-1";

      // save 3 notifications
      dao.save({ id: "n1", projectId: pid, type: "analysis_complete", title: "Done", body: "ok", createdAt: new Date().toISOString() });
      dao.save({ id: "n2", projectId: pid, type: "gate_failed", title: "Fail", body: "bad", severity: "critical", createdAt: new Date().toISOString() });
      dao.save({ id: "n3", projectId: pid, type: "critical_finding", title: "Crit", body: "crit", createdAt: new Date().toISOString() });

      // findByProjectId
      expect(dao.findByProjectId(pid)).toHaveLength(3);
      expect(dao.findByProjectId(pid, true)).toHaveLength(3); // all unread
      expect(dao.findByProjectId(pid, false, 2)).toHaveLength(2); // limit

      // unreadCount
      expect(dao.unreadCount(pid)).toBe(3);

      // markAsRead
      dao.markAsRead("n1");
      expect(dao.unreadCount(pid)).toBe(2);
      expect(dao.findByProjectId(pid, true)).toHaveLength(2);

      // markAllAsRead
      dao.markAllAsRead(pid);
      expect(dao.unreadCount(pid)).toBe(0);
      expect(dao.findByProjectId(pid, true)).toHaveLength(0);
      expect(dao.findByProjectId(pid)).toHaveLength(3); // all still exist
    });

    it("isolates by projectId", () => {
      const dao = new NotificationDAO(db);
      dao.save({ id: "na", projectId: "pA", type: "analysis_complete", title: "A", body: "", createdAt: new Date().toISOString() });
      dao.save({ id: "nb", projectId: "pB", type: "analysis_complete", title: "B", body: "", createdAt: new Date().toISOString() });

      expect(dao.findByProjectId("pA")).toHaveLength(1);
      expect(dao.findByProjectId("pB")).toHaveLength(1);
      expect(dao.unreadCount("pA")).toBe(1);
    });
  });

  describe("UserDAO + SessionDAO", () => {
    it("UserDAO: save → findById → findByUsername → findAll → count", () => {
      const dao = new UserDAO(db);

      dao.save({ id: "u1", username: "alice", displayName: "Alice", passwordHash: "salt:hash1", role: "analyst" });
      dao.save({ id: "u2", username: "bob", displayName: "Bob", passwordHash: "salt:hash2", role: "admin" });

      expect(dao.findById("u1")?.username).toBe("alice");
      expect(dao.findById("u1")?.role).toBe("analyst");
      expect(dao.findByUsername("bob")?.displayName).toBe("Bob");
      expect(dao.findByUsername("bob")?.passwordHash).toBe("salt:hash2");
      expect(dao.findByUsername("nobody")).toBeUndefined();
      expect(dao.findAll()).toHaveLength(2);
      expect(dao.count()).toBe(2);
    });

    it("SessionDAO: create → findByToken → deleteByToken", () => {
      const userDao = new UserDAO(db);
      const sessionDao = new SessionDAO(db);

      userDao.save({ id: "u1", username: "alice", displayName: "Alice", passwordHash: "h", role: "analyst" });

      const expires = new Date(Date.now() + 3600000).toISOString();
      sessionDao.create("tok-1", "u1", expires);

      const session = sessionDao.findByToken("tok-1");
      expect(session).toBeDefined();
      expect(session!.userId).toBe("u1");

      expect(sessionDao.findByToken("nonexistent")).toBeUndefined();

      sessionDao.deleteByToken("tok-1");
      expect(sessionDao.findByToken("tok-1")).toBeUndefined();
    });
  });

  describe("FindingDAO — CWE/CVE/confidenceScore round-trip", () => {
    it("saves and loads cweId, cveIds, confidenceScore", () => {
      const runDao = new RunDAO(db);
      const findingDao = new FindingDAO(db);
      const projectDao = new ProjectDAO(db);

      projectDao.save(makeProject({ id: "p-cwe" }));
      runDao.save(makeRun({ id: "r-cwe", projectId: "p-cwe" }));

      const finding = makeFinding({
        id: "f-cwe",
        runId: "r-cwe",
        projectId: "p-cwe",
        cweId: "CWE-120",
        cveIds: ["CVE-2025-0001", "CVE-2025-0002"],
        confidenceScore: 0.85,
      });
      findingDao.save(finding);

      const loaded = findingDao.findById("f-cwe")!;
      expect(loaded.cweId).toBe("CWE-120");
      expect(loaded.cveIds).toEqual(["CVE-2025-0001", "CVE-2025-0002"]);
      expect(loaded.confidenceScore).toBe(0.85);
    });

    it("handles missing CWE/CVE gracefully", () => {
      const runDao = new RunDAO(db);
      const findingDao = new FindingDAO(db);
      const projectDao = new ProjectDAO(db);

      projectDao.save(makeProject({ id: "p-no-cwe" }));
      runDao.save(makeRun({ id: "r-no-cwe", projectId: "p-no-cwe" }));

      const finding = makeFinding({ id: "f-no-cwe", runId: "r-no-cwe", projectId: "p-no-cwe" });
      findingDao.save(finding);

      const loaded = findingDao.findById("f-no-cwe")!;
      expect(loaded.cweId).toBeUndefined();
      expect(loaded.cveIds).toBeUndefined();
      expect(loaded.confidenceScore).toBeUndefined();
    });
  });

  describe("FindingDAO — grouping and aggregation", () => {
    let findingDao: FindingDAO;
    let runDao: RunDAO;

    beforeEach(() => {
      findingDao = new FindingDAO(db);
      runDao = new RunDAO(db);
      const projectDao = new ProjectDAO(db);
      projectDao.save(makeProject({ id: "p-grp" }));
      runDao.save(makeRun({ id: "r-grp", projectId: "p-grp" }));
    });

    it("severitySummaryByProjectId counts unresolved by severity", () => {
      findingDao.save(makeFinding({ id: "f1", runId: "r-grp", projectId: "p-grp", severity: "critical", status: "open" }));
      findingDao.save(makeFinding({ id: "f2", runId: "r-grp", projectId: "p-grp", severity: "high", status: "needs_review" }));
      findingDao.save(makeFinding({ id: "f3", runId: "r-grp", projectId: "p-grp", severity: "high", status: "open" }));
      findingDao.save(makeFinding({ id: "f4", runId: "r-grp", projectId: "p-grp", severity: "critical", status: "fixed" })); // excluded

      const summary = findingDao.severitySummaryByProjectId("p-grp");
      expect(summary.critical).toBe(1);
      expect(summary.high).toBe(2);
      expect(summary.medium).toBe(0);
    });

    it("unresolvedCountByProjectId counts only unresolved statuses", () => {
      findingDao.save(makeFinding({ id: "uf1", runId: "r-grp", projectId: "p-grp", status: "open" }));
      findingDao.save(makeFinding({ id: "uf2", runId: "r-grp", projectId: "p-grp", status: "needs_review" }));
      findingDao.save(makeFinding({ id: "uf3", runId: "r-grp", projectId: "p-grp", status: "fixed" }));
      findingDao.save(makeFinding({ id: "uf4", runId: "r-grp", projectId: "p-grp", status: "false_positive" }));

      expect(findingDao.unresolvedCountByProjectId("p-grp")).toBe(2);
    });

    it("groupByRuleId groups findings by ruleId", () => {
      findingDao.save(makeFinding({ id: "gr1", runId: "r-grp", projectId: "p-grp", ruleId: "rule-A", severity: "high" }));
      findingDao.save(makeFinding({ id: "gr2", runId: "r-grp", projectId: "p-grp", ruleId: "rule-A", severity: "critical" }));
      findingDao.save(makeFinding({ id: "gr3", runId: "r-grp", projectId: "p-grp", ruleId: "rule-B", severity: "low" }));

      const groups = findingDao.groupByRuleId("p-grp");
      expect(groups.length).toBeGreaterThanOrEqual(2);
      const ruleA = groups.find((g: any) => g.key === "rule-A");
      expect(ruleA?.count).toBe(2);
    });

    it("groupByLocation groups findings by file path", () => {
      findingDao.save(makeFinding({ id: "gl1", runId: "r-grp", projectId: "p-grp", location: "src/main.c:10", severity: "high" }));
      findingDao.save(makeFinding({ id: "gl2", runId: "r-grp", projectId: "p-grp", location: "src/main.c:20", severity: "medium" }));
      findingDao.save(makeFinding({ id: "gl3", runId: "r-grp", projectId: "p-grp", location: "src/util.c:5", severity: "low" }));

      const groups = findingDao.groupByLocation("p-grp");
      expect(groups.length).toBeGreaterThanOrEqual(2);
    });
  });
});
