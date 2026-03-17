import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Database as DatabaseType } from "better-sqlite3";
import { createTestDb } from "../../test/test-db";
import { ProjectDAO } from "../../dao/project.dao";
import { RuleDAO } from "../../dao/rule.dao";
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
import {
  makeProject,
  makeRun,
  makeFinding,
  makeEvidenceRef,
  makeGateResult,
  makeApproval,
  makeAuditLog,
  makeAnalysisResult,
  makeRule,
  makeStoredFile,
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

  describe("RuleDAO", () => {
    it("save → findByProjectId → toggle → update → delete", () => {
      const dao = new RuleDAO(db);
      const rule = makeRule({ id: "R1", projectId: "p1", enabled: true });

      dao.save(rule);
      const found = dao.findByProjectId("p1");
      expect(found).toHaveLength(1);
      expect(found[0].enabled).toBe(true);

      dao.toggleEnabled("R1", false);
      expect(dao.findById("R1")?.enabled).toBe(false);

      const updated = dao.update("R1", { name: "Renamed" });
      expect(updated?.name).toBe("Renamed");

      expect(dao.delete("R1")).toBe(true);
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
});
