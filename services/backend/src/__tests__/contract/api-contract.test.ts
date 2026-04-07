import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import type { Database as DatabaseType } from "better-sqlite3";
import type express from "express";
import { createTestApp, type TestAppContext } from "../../test/create-test-app";
import {
  makeProject,
  makeRun,
  makeFinding,
  makeEvidenceRef,
  makeGateResult,
  makeApproval,
  makeAnalysisResult,
  makeStoredFile,
  makeBuildTarget,
  makeNotification,
} from "../../test/factories";

describe("API Contract Tests", () => {
  let ctx: TestAppContext;
  let app: express.Express;

  beforeEach(() => {
    ctx = createTestApp();
    app = ctx.app;
  });
  afterEach(() => {
    ctx.db.close();
  });

  // ── Projects ──

  describe("GET /api/projects", () => {
    it("returns { success, data: Project[] }", async () => {
      ctx.projectDAO.save(makeProject({ id: "p1", name: "A" }));
      ctx.projectDAO.save(makeProject({ id: "p2", name: "B" }));

      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);

      const proj = res.body.data[0];
      expect(proj).toHaveProperty("id");
      expect(proj).toHaveProperty("name");
      expect(proj).toHaveProperty("description");
      expect(proj).toHaveProperty("createdAt");
      expect(proj).toHaveProperty("updatedAt");
    });
  });

  describe("POST /api/projects", () => {
    it("creates project and returns { success, data: Project }", async () => {
      const res = await request(app)
        .post("/api/projects")
        .send({ name: "New Project", description: "test" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.name).toBe("New Project");
    });
  });

  describe("GET /api/projects/:id", () => {
    it("returns { success, data: Project }", async () => {
      ctx.projectDAO.save(makeProject({ id: "p1", name: "Test" }));

      const res = await request(app).get("/api/projects/p1");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("p1");
    });

    it("returns 404 for nonexistent project", async () => {
      const res = await request(app).get("/api/projects/nonexistent");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/projects/:id/overview", () => {
    it("returns raw ProjectOverviewResponse without the success envelope", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-overview", name: "Overview" }));

      const res = await request(app).get("/api/projects/p-overview/overview");
      expect(res.status).toBe(200);
      expect(res.body.success).toBeUndefined();
      expect(res.body).toHaveProperty("project");
      expect(res.body.project.id).toBe("p-overview");
    });
  });

  // ── Files ──

  describe("GET /api/projects/:pid/files", () => {
    it("returns { success, data: UploadedFile[] }", async () => {
      ctx.projectDAO.save(makeProject({ id: "p1" }));
      ctx.fileStore.save(makeStoredFile({ id: "f1", projectId: "p1", name: "main.c" }));

      const res = await request(app).get("/api/projects/p1/files");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty("id");
      expect(res.body.data[0]).toHaveProperty("name");
      expect(res.body.data[0]).toHaveProperty("size");
    });
  });

  // ── Runs ──

  describe("GET /api/projects/:pid/runs", () => {
    it("returns { success, data: Run[] }", async () => {
      ctx.projectDAO.save(makeProject({ id: "p1" }));
      ctx.runDAO.save(makeRun({ id: "run-1", projectId: "p1" }));

      const res = await request(app).get("/api/projects/p1/runs");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        const run = res.body.data[0];
        expect(run).toHaveProperty("id");
        expect(run).toHaveProperty("projectId");
        expect(run).toHaveProperty("module");
        expect(run).toHaveProperty("status");
        expect(run).toHaveProperty("findingCount");
      }
    });
  });

  describe("GET /api/runs/:id", () => {
    it("returns run detail with gate and findings", async () => {
      ctx.runDAO.save(makeRun({ id: "run-1", projectId: "p1" }));
      ctx.findingDAO.save(makeFinding({ id: "f1", runId: "run-1", projectId: "p1" }));

      const res = await request(app).get("/api/runs/run-1");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("run");
      expect(res.body.data.run.id).toBe("run-1");
      expect(res.body.data).toHaveProperty("findings");
      expect(Array.isArray(res.body.data.findings)).toBe(true);
    });

    it("returns 404 for nonexistent run", async () => {
      const res = await request(app).get("/api/runs/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  // ── Findings ──

  describe("GET /api/projects/:pid/findings", () => {
    it("returns { success, data: Finding[] }", async () => {
      ctx.findingDAO.save(makeFinding({ id: "f1", projectId: "p1", severity: "high", status: "open" }));

      const res = await request(app).get("/api/projects/p1/findings");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        const finding = res.body.data[0];
        expect(finding).toHaveProperty("id");
        expect(finding).toHaveProperty("severity");
        expect(finding).toHaveProperty("status");
        expect(finding).toHaveProperty("title");
        expect(finding).toHaveProperty("sourceType");
      }
    });
  });

  describe("GET /api/findings/:id", () => {
    it("returns finding with evidenceRefs and auditLog", async () => {
      const finding = makeFinding({ id: "f1", projectId: "p1" });
      ctx.findingDAO.save(finding);
      ctx.evidenceRefDAO.save(makeEvidenceRef({ findingId: "f1" }));

      const res = await request(app).get("/api/findings/f1");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id", "f1");
      expect(res.body.data).toHaveProperty("evidenceRefs");
      expect(res.body.data).toHaveProperty("auditLog");
      expect(Array.isArray(res.body.data.evidenceRefs)).toBe(true);
    });

    it("returns 404 for nonexistent finding", async () => {
      const res = await request(app).get("/api/findings/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/findings/:id/status", () => {
    it("updates finding status and returns updated finding", async () => {
      ctx.findingDAO.save(makeFinding({ id: "f1", projectId: "p1", status: "open" }));

      const res = await request(app)
        .patch("/api/findings/f1/status")
        .send({ status: "needs_review", actor: "analyst", reason: "review needed" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("needs_review");
    });

    it("returns 400 for invalid transition", async () => {
      ctx.findingDAO.save(makeFinding({ id: "f1", projectId: "p1", status: "open" }));

      const res = await request(app)
        .patch("/api/findings/f1/status")
        .send({ status: "sandbox", actor: "analyst", reason: "bad transition" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Quality Gates ──

  describe("GET /api/projects/:pid/gates", () => {
    it("returns { success, data: GateResult[] }", async () => {
      ctx.gateResultDAO.save(makeGateResult({ id: "g1", projectId: "p1", runId: "run-1" }));

      const res = await request(app).get("/api/projects/p1/gates");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        const gate = res.body.data[0];
        expect(gate).toHaveProperty("id");
        expect(gate).toHaveProperty("status");
        expect(gate).toHaveProperty("rules");
        expect(gate).toHaveProperty("evaluatedAt");
      }
    });
  });

  describe("GET /api/gates/:id", () => {
    it("returns gate result detail", async () => {
      ctx.gateResultDAO.save(makeGateResult({ id: "g1", runId: "run-1", projectId: "p1" }));

      const res = await request(app).get("/api/gates/g1");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("g1");
      expect(res.body.data).toHaveProperty("status");
      expect(res.body.data).toHaveProperty("rules");
    });

    it("returns 404 for nonexistent gate", async () => {
      const res = await request(app).get("/api/gates/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  // ── Approvals ──

  describe("GET /api/projects/:pid/approvals", () => {
    it("returns { success, data: ApprovalRequest[] }", async () => {
      ctx.approvalDAO.save(makeApproval({
        id: "ap-1",
        projectId: "p1",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }));

      const res = await request(app).get("/api/projects/p1/approvals");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        const approval = res.body.data[0];
        expect(approval).toHaveProperty("id");
        expect(approval).toHaveProperty("actionType");
        expect(approval).toHaveProperty("status");
        expect(approval).toHaveProperty("expiresAt");
      }
    });
  });

  describe("POST /api/approvals/:id/decide", () => {
    it("approves and returns updated approval", async () => {
      ctx.approvalDAO.save(makeApproval({
        id: "ap-1",
        projectId: "p1",
        status: "pending",
        actionType: "finding.accepted_risk",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }));

      const res = await request(app)
        .post("/api/approvals/ap-1/decide")
        .send({ decision: "approved", actor: "admin", comment: "ok" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("approved");
      expect(res.body.data).toHaveProperty("decision");
    });
  });

  // ── Reports ──

  describe("GET /api/projects/:pid/report", () => {
    it("returns project report when data exists", async () => {
      ctx.projectDAO.save(makeProject({ id: "p1", name: "Test" }));
      ctx.runDAO.save(makeRun({ id: "run-1", projectId: "p1", module: "static_analysis", findingCount: 1 }));
      ctx.findingDAO.save(makeFinding({ id: "f1", runId: "run-1", projectId: "p1", module: "static_analysis" }));
      ctx.gateResultDAO.save(makeGateResult({ id: "g1", runId: "run-1", projectId: "p1" }));

      const res = await request(app).get("/api/projects/p1/report");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("modules");
      expect(res.body.data).toHaveProperty("totalSummary");
    });

    it("returns 200 with empty report when project has no findings", async () => {
      ctx.projectDAO.save(makeProject({ id: "p2", name: "Empty" }));

      const res = await request(app).get("/api/projects/p2/report");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalSummary.totalFindings).toBe(0);
    });

    it("returns 404 for nonexistent project", async () => {
      const res = await request(app).get("/api/projects/nonexistent/report");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/projects/:pid/report/static", () => {
    it("returns module report when data exists", async () => {
      ctx.projectDAO.save(makeProject({ id: "p1", name: "Test" }));
      ctx.runDAO.save(makeRun({ id: "run-1", projectId: "p1", module: "static_analysis" }));
      ctx.findingDAO.save(makeFinding({ id: "f1", runId: "run-1", projectId: "p1", module: "static_analysis" }));

      const res = await request(app).get("/api/projects/p1/report/static");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("summary");
      expect(res.body.data).toHaveProperty("findings");
      expect(res.body.data).toHaveProperty("runs");
    });

    it("returns 404 for nonexistent project", async () => {
      const res = await request(app).get("/api/projects/nonexistent/report/static");
      expect(res.status).toBe(404);
    });
  });

  // ── Error response structure ──

  describe("Error response contract", () => {
    it("returns { success: false, error: string } for inline controller errors", async () => {
      const res = await request(app).get("/api/projects/nonexistent");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(typeof res.body.error).toBe("string");
    });

    it("returns { success: false, error, errorDetail } for AppError middleware errors", async () => {
      // Invalid status transition → InvalidInputError → error handler middleware
      ctx.findingDAO.save(makeFinding({ id: "f-err", projectId: "p1", status: "open" }));

      const res = await request(app)
        .patch("/api/findings/f-err/status")
        .send({ status: "sandbox", actor: "test", reason: "test" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(typeof res.body.error).toBe("string");
      expect(res.body.errorDetail).toHaveProperty("code", "INVALID_INPUT");
      expect(res.body.errorDetail).toHaveProperty("message");
      expect(res.body.errorDetail.retryable).toBe(false);
    });
  });

  // ── Finding Bulk Status ──

  describe("PATCH /api/findings/bulk-status", () => {
    it("updates multiple findings and returns counts", async () => {
      ctx.findingDAO.save(makeFinding({ id: "fb1", projectId: "p1", status: "open" }));
      ctx.findingDAO.save(makeFinding({ id: "fb2", projectId: "p1", status: "open" }));

      const res = await request(app)
        .patch("/api/findings/bulk-status")
        .send({ findingIds: ["fb1", "fb2"], status: "needs_review", reason: "batch review", actor: "analyst" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ updated: 2, failed: 0 });

      // verify actual status changed
      const f1 = ctx.findingDAO.findById("fb1");
      expect(f1?.status).toBe("needs_review");
    });

    it("returns 400 when findingIds is empty", async () => {
      const res = await request(app)
        .patch("/api/findings/bulk-status")
        .send({ findingIds: [], status: "fixed", reason: "test" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 when findingIds exceeds 100", async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `f-${i}`);
      const res = await request(app)
        .patch("/api/findings/bulk-status")
        .send({ findingIds: ids, status: "fixed", reason: "test" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when status or reason missing", async () => {
      const res = await request(app)
        .patch("/api/findings/bulk-status")
        .send({ findingIds: ["fb1"] });

      expect(res.status).toBe(400);
    });

    it("counts invalid transitions as failed", async () => {
      ctx.findingDAO.save(makeFinding({ id: "fb-inv", projectId: "p1", status: "open" }));

      const res = await request(app)
        .patch("/api/findings/bulk-status")
        .send({ findingIds: ["fb-inv", "fb-ghost"], status: "sandbox", reason: "bad", actor: "x" });

      expect(res.status).toBe(200);
      // open→sandbox invalid + fb-ghost not found = both fail
      expect(res.body.data).toEqual({ updated: 0, failed: 2 });
    });
  });

  // ── Finding History ──

  describe("GET /api/findings/:id/history", () => {
    it("returns fingerprint history", async () => {
      ctx.findingDAO.save(makeFinding({ id: "fh1", runId: "run-h1", projectId: "p1", fingerprint: "fp-abc", status: "fixed", createdAt: "2026-03-20T00:00:00Z" }));
      ctx.findingDAO.save(makeFinding({ id: "fh2", runId: "run-h2", projectId: "p1", fingerprint: "fp-abc", status: "open", createdAt: "2026-03-25T00:00:00Z" }));

      const res = await request(app).get("/api/findings/fh2/history");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty("findingId");
      expect(res.body.data[0]).toHaveProperty("runId");
      expect(res.body.data[0]).toHaveProperty("status");
      expect(res.body.data[0]).toHaveProperty("createdAt");
    });

    it("returns empty array when finding has no fingerprint", async () => {
      ctx.findingDAO.save(makeFinding({ id: "fh-nofp", projectId: "p1" }));

      const res = await request(app).get("/api/findings/fh-nofp/history");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("returns 404 for nonexistent finding", async () => {
      const res = await request(app).get("/api/findings/no-such/history");
      expect(res.status).toBe(404);
    });
  });

  // ── Finding Filters/Sort ──

  describe("GET /api/projects/:pid/findings — extended filters", () => {
    it("filters by text search (q)", async () => {
      ctx.findingDAO.save(makeFinding({ id: "fq1", projectId: "p-fq", title: "Buffer overflow in main.c" }));
      ctx.findingDAO.save(makeFinding({ id: "fq2", projectId: "p-fq", title: "SQL injection" }));

      const res = await request(app).get("/api/projects/p-fq/findings?q=Buffer");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe("fq1");
    });

    it("filters by sourceType", async () => {
      ctx.findingDAO.save(makeFinding({ id: "fst1", projectId: "p-fst", sourceType: "agent" }));
      ctx.findingDAO.save(makeFinding({ id: "fst2", projectId: "p-fst", sourceType: "sast-tool" }));

      const res = await request(app).get("/api/projects/p-fst/findings?sourceType=agent");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe("fst1");
    });

    it("sorts by severity asc", async () => {
      ctx.findingDAO.save(makeFinding({ id: "fs1", projectId: "p-fs", severity: "low" }));
      ctx.findingDAO.save(makeFinding({ id: "fs2", projectId: "p-fs", severity: "critical" }));

      const res = await request(app).get("/api/projects/p-fs/findings?sort=severity&order=asc");
      expect(res.status).toBe(200);
      expect(res.body.data[0].severity).toBe("critical");
      expect(res.body.data[1].severity).toBe("low");
    });
  });

  // ── Approval Count ──

  describe("GET /api/projects/:pid/approvals/count", () => {
    it("returns pending and total counts", async () => {
      ctx.approvalDAO.save(makeApproval({
        id: "ac-1", projectId: "p-ac", status: "pending",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }));
      ctx.approvalDAO.save(makeApproval({
        id: "ac-2", projectId: "p-ac", status: "pending",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }));

      const res = await request(app).get("/api/projects/p-ac/approvals/count");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ pending: 2, total: 2 });
    });

    it("returns zero counts when no approvals", async () => {
      const res = await request(app).get("/api/projects/p-empty/approvals/count");
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ pending: 0, total: 0 });
    });
  });

  // ── Activity Timeline ──

  describe("GET /api/projects/:pid/activity", () => {
    it("returns timeline entries sorted by timestamp", async () => {
      ctx.runDAO.save(makeRun({ id: "ra-1", projectId: "p-act", status: "completed", module: "static_analysis", findingCount: 3, endedAt: "2026-03-26T09:00:00Z" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "ta-1", projectId: "p-act", name: "gw", status: "ready", updatedAt: "2026-03-26T10:00:00Z" }));

      const res = await request(app).get("/api/projects/p-act/activity?limit=10");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      for (const entry of res.body.data) {
        expect(entry).toHaveProperty("type");
        expect(entry).toHaveProperty("timestamp");
        expect(entry).toHaveProperty("summary");
        expect(entry).toHaveProperty("metadata");
      }

      // pipeline event (10:00) should come before run event (09:00)
      const types = res.body.data.map((e: any) => e.type);
      const pipeIdx = types.indexOf("pipeline_completed");
      const runIdx = types.indexOf("run_completed");
      expect(pipeIdx).toBeLessThan(runIdx);
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        ctx.runDAO.save(makeRun({ id: `ra-lim-${i}`, projectId: "p-lim", status: "completed", findingCount: 0, endedAt: `2026-03-26T0${i}:00:00Z` }));
      }

      const res = await request(app).get("/api/projects/p-lim/activity?limit=3");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
    });

    it("returns empty array for empty project", async () => {
      const res = await request(app).get("/api/projects/p-empty/activity");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ── Build Targets ──

  describe("Build Targets", () => {
    it("POST /api/projects/:pid/targets creates target", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-bt" }));

      const res = await request(app)
        .post("/api/projects/p-bt/targets")
        .send({ name: "gateway", relativePath: "gateway/", buildSystem: "cmake" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("gateway");
      expect(res.body.data.relativePath).toBe("gateway/");
      expect(res.body.data.id).toMatch(/^target-/);
    });

    it("GET /api/projects/:pid/targets lists targets", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-bt2" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "t1", projectId: "p-bt2", name: "a" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "t2", projectId: "p-bt2", name: "b" }));

      const res = await request(app).get("/api/projects/p-bt2/targets");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it("PUT /api/projects/:pid/targets/:id updates target", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-bt3" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "t3", projectId: "p-bt3", name: "old" }));

      const res = await request(app)
        .put("/api/projects/p-bt3/targets/t3")
        .send({ name: "new-name" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("new-name");
    });

    it("DELETE /api/projects/:pid/targets/:id deletes target", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-bt4" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "t4", projectId: "p-bt4" }));

      const res = await request(app).delete("/api/projects/p-bt4/targets/t4");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("POST rejects relativePath with ..", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-bt5" }));

      const res = await request(app)
        .post("/api/projects/p-bt5/targets")
        .send({ name: "evil", relativePath: "../etc/" });

      expect(res.status).toBe(400);
    });

    it("returns 404 for wrong project ownership", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-bt6" }));
      ctx.projectDAO.save(makeProject({ id: "p-bt7" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "t6", projectId: "p-bt6" }));

      const res = await request(app).put("/api/projects/p-bt7/targets/t6").send({ name: "x" });
      expect(res.status).toBe(404);
    });

    it("POST /api/projects/:pid/targets/discover returns discovery payload", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-bt-discover" }));

      const res = await request(app).post("/api/projects/p-bt-discover/targets/discover");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        discovered: 1,
        created: 1,
        elapsedMs: 123,
      });
      expect(res.body.data.targets).toHaveLength(1);
      expect(res.body.data.targets[0]).toMatchObject({
        projectId: "p-bt-discover",
        name: "auto-discovered",
        relativePath: "auto-discovered/",
        buildSystem: "cmake",
      });
    });

    it("PUT /api/projects/:pid/targets/:id rejects includedPaths updates explicitly", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-bt8" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "t8", projectId: "p-bt8" }));

      const res = await request(app)
        .put("/api/projects/p-bt8/targets/t8")
        .send({ includedPaths: ["src/"] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("includedPaths updates are not supported");
      expect(res.body.errorDetail.code).toBe("INVALID_INPUT");
      expect(res.body.errorDetail.retryable).toBe(false);
    });
  });

  // ── SDK API ──

  describe("SDK API", () => {
    it("GET /api/projects/:pid/sdk returns builtIn and registered arrays", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-sdk" }));

      const createRes = await request(app)
        .post("/api/projects/p-sdk/sdk")
        .send({ name: "TI SDK", localPath: "/opt/sdk-one", description: "Cross toolchain" });
      expect(createRes.status).toBe(202);

      const res = await request(app).get("/api/projects/p-sdk/sdk");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.builtIn)).toBe(true);
      expect(Array.isArray(res.body.data.registered)).toBe(true);
      expect(res.body.data.registered).toHaveLength(1);
      expect(res.body.data.registered[0].id).toBe(createRes.body.data.id);
    });

    it("GET /api/projects/:pid/sdk/:id returns RegisteredSdk detail", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-sdk2" }));

      const createRes = await request(app)
        .post("/api/projects/p-sdk2/sdk")
        .send({ name: "Yocto SDK", localPath: "/opt/sdk-two" });

      const res = await request(app).get(`/api/projects/p-sdk2/sdk/${createRes.body.data.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: createRes.body.data.id,
        projectId: "p-sdk2",
        name: "Yocto SDK",
        path: "/opt/sdk-two",
        status: "uploading",
        verified: false,
      });
    });

    it("POST /api/projects/:pid/sdk returns 202 with a full RegisteredSdk payload", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-sdk3" }));

      const res = await request(app)
        .post("/api/projects/p-sdk3/sdk")
        .send({ name: "SDK Upload", localPath: "/opt/sdk-three", description: "ARM toolchain" });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        projectId: "p-sdk3",
        name: "SDK Upload",
        description: "ARM toolchain",
        path: "/opt/sdk-three",
        status: "uploading",
        verified: false,
      });
      expect(res.body.data.id).toMatch(/^sdk-test-/);
      expect(res.body.data.createdAt).toBeTypeOf("string");
      expect(res.body.data.updatedAt).toBeTypeOf("string");
    });
  });

  describe("Source API", () => {
    it("GET /api/projects/:pid/source/files returns data plus composition metadata and targetMapping", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-src" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "t-src", projectId: "p-src", relativePath: "src/" }));

      const res = await request(app).get("/api/projects/p-src/source/files?filter=source");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body).toMatchObject({
        composition: { source: 1, doc: 1 },
        totalFiles: 2,
        totalSize: 192,
      });
      expect(res.body.targetMapping).toMatchObject({
        "src/main.c": { targetId: "t-src", targetName: expect.any(String) },
      });
    });

    it("GET /api/projects/:pid/source/file returns content with file metadata", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-src-file" }));

      const res = await request(app).get("/api/projects/p-src-file/source/file?path=src/main.c");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        path: "src/main.c",
        content: "contents:src/main.c",
        size: 128,
        language: "c",
        fileType: "source",
        previewable: true,
        lineCount: 3,
      });
    });
  });

  // ================================================================
  // Pipeline API
  // ================================================================

  describe("Pipeline API", () => {
    it("POST /pipeline/run returns accepted pipeline payload", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-pipe-run" }));

      const res = await request(app)
        .post("/api/projects/p-pipe-run/pipeline/run")
        .send({ targetIds: ["t-a", "t-b"] });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pipelineId).toMatch(/^pipe-/);
      expect(res.body.data.status).toBe("running");
      expect(ctx.pipelineRunCalls[ctx.pipelineRunCalls.length - 1]).toMatchObject({
        projectId: "p-pipe-run",
        targetIds: ["t-a", "t-b"],
      });
    });

    it("GET /pipeline/status returns targets with phase mapping", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-pipe" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "tp1", projectId: "p-pipe", status: "discovered" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "tp2", projectId: "p-pipe", status: "ready" }));

      const res = await request(app).get("/api/projects/p-pipe/pipeline/status");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targets).toHaveLength(2);
      expect(res.body.data.readyCount).toBe(1);

      const discovered = res.body.data.targets.find((t: any) => t.id === "tp1");
      expect(discovered.phase).toBe("setup");

      const ready = res.body.data.targets.find((t: any) => t.id === "tp2");
      expect(ready.phase).toBe("ready");
    });

    it("GET /pipeline/status returns 404 for unknown project", async () => {
      const res = await request(app).get("/api/projects/nonexistent/pipeline/status");
      expect(res.status).toBe(404);
    });

    it("GET /pipeline/status maps resolving/resolve_failed to setup", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-pipe2" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "tp3", projectId: "p-pipe2", status: "resolving" as any }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "tp4", projectId: "p-pipe2", status: "resolve_failed" as any }));

      const res = await request(app).get("/api/projects/p-pipe2/pipeline/status");
      expect(res.status).toBe(200);

      for (const t of res.body.data.targets) {
        expect(t.phase).toBe("setup");
      }
    });

    it("POST /pipeline/run/:targetId returns rerun payload and resets failed targets", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-rerun" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "tp-rerun", projectId: "p-rerun", status: "build_failed" as any }));

      const res = await request(app).post("/api/projects/p-rerun/pipeline/run/tp-rerun");

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ targetId: "tp-rerun", status: "running" });
      expect(ctx.buildTargetDAO.findById("tp-rerun")?.status).toBe("discovered");
      expect(ctx.pipelineRunCalls[ctx.pipelineRunCalls.length - 1]).toMatchObject({
        projectId: "p-rerun",
        targetIds: ["tp-rerun"],
      });
    });

    it("GET /pipeline/status includes optional artifact fields when present", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-pipe3" }));
      ctx.buildTargetDAO.save(makeBuildTarget({
        id: "tp-opt",
        projectId: "p-pipe3",
        status: "built",
      }));
      ctx.buildTargetDAO.updatePipelineState("tp-opt", {
        status: "built",
        compileCommandsPath: "/tmp/compile_commands.json",
        sastScanId: "scan-123",
        codeGraphNodeCount: 42,
        lastBuiltAt: "2026-04-04T05:00:00.000Z",
      });

      const res = await request(app).get("/api/projects/p-pipe3/pipeline/status");
      expect(res.status).toBe(200);

      expect(res.body.data.targets[0]).toMatchObject({
        id: "tp-opt",
        compileCommandsPath: "/tmp/compile_commands.json",
        sastScanId: "scan-123",
        codeGraphNodeCount: 42,
        lastBuiltAt: "2026-04-04T05:00:00.000Z",
      });
    });
  });

  describe("Analysis API", () => {
    it("POST /api/analysis/run returns 202 accepted payload and dispatches async run", async () => {
      const res = await request(app)
        .post("/api/analysis/run")
        .send({ projectId: "p-analysis", mode: "subproject", targetIds: ["t-1"] });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.analysisId).toMatch(/^analysis-/);
      expect(res.body.data.status).toBe("running");
      expect(ctx.analysisRunCalls[ctx.analysisRunCalls.length - 1]).toMatchObject({
        projectId: "p-analysis",
        targetIds: ["t-1"],
      });
    });

    it("POST /api/analysis/run enforces mode validation rules", async () => {
      const invalidMode = await request(app)
        .post("/api/analysis/run")
        .send({ projectId: "p-analysis", mode: "weird" });
      expect(invalidMode.status).toBe(400);
      expect(invalidMode.body.error).toContain('mode must be "full" or "subproject"');

      const missingTargets = await request(app)
        .post("/api/analysis/run")
        .send({ projectId: "p-analysis", mode: "subproject" });
      expect(missingTargets.status).toBe(400);
      expect(missingTargets.body.error).toContain("targetIds is required");

      const fullWithTargets = await request(app)
        .post("/api/analysis/run")
        .send({ projectId: "p-analysis", mode: "full", targetIds: ["t-1"] });
      expect(fullWithTargets.status).toBe(400);
      expect(fullWithTargets.body.error).toContain("targetIds must be empty");
    });
  });

  // ── Gate Profiles ──

  describe("Gate Profile API", () => {
    it("GET /api/gate-profiles returns 3 profiles", async () => {
      const res = await request(app).get("/api/gate-profiles");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data.map((p: any) => p.id).sort()).toEqual(["default", "relaxed", "strict"]);
    });

    it("GET /api/gate-profiles/:id returns single profile", async () => {
      const res = await request(app).get("/api/gate-profiles/strict");
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe("strict");
      expect(res.body.data.rules).toBeDefined();
    });

    it("GET /api/gate-profiles/:id returns 404 for unknown", async () => {
      const res = await request(app).get("/api/gate-profiles/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  // ── Notifications ──

  describe("Notification API", () => {
    it("GET /api/projects/:pid/notifications returns list", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-notif" }));
      ctx.notificationService.emit({ projectId: "p-notif", type: "analysis_complete", title: "Test" });

      const res = await request(app).get("/api/projects/p-notif/notifications");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty("type", "analysis_complete");
    });

    it("GET /api/projects/:pid/notifications/count returns unread count", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-notif-c" }));
      ctx.notificationService.emit({ projectId: "p-notif-c", type: "gate_failed", title: "Fail" });
      ctx.notificationService.emit({ projectId: "p-notif-c", type: "critical_finding", title: "Crit" });

      const res = await request(app).get("/api/projects/p-notif-c/notifications/count");
      expect(res.status).toBe(200);
      expect(res.body.data.unread).toBe(2);
    });

    it("PATCH /api/projects/:pid/notifications/read-all marks all read", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-notif-r" }));
      ctx.notificationService.emit({ projectId: "p-notif-r", type: "analysis_complete", title: "A" });
      ctx.notificationService.emit({ projectId: "p-notif-r", type: "gate_failed", title: "B" });

      const res = await request(app).patch("/api/projects/p-notif-r/notifications/read-all");
      expect(res.status).toBe(200);

      const countRes = await request(app).get("/api/projects/p-notif-r/notifications/count");
      expect(countRes.body.data.unread).toBe(0);
    });

    it("PATCH /api/notifications/:id/read marks single read", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-notif-s" }));
      const notif = ctx.notificationService.emit({ projectId: "p-notif-s", type: "analysis_complete", title: "X" });

      const res = await request(app).patch(`/api/notifications/${notif.id}/read`);
      expect(res.status).toBe(200);
    });
  });

  // ── Auth ──

  describe("Auth API", () => {
    it("POST /api/auth/login with valid credentials", async () => {
      ctx.userService.createUser("testuser", "pass1234", "Test User");
      const res = await request(app).post("/api/auth/login").send({ username: "testuser", password: "pass1234" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.username).toBe("testuser");
    });

    it("POST /api/auth/login with invalid credentials", async () => {
      ctx.userService.createUser("testuser2", "pass1234", "Test User 2");
      const res = await request(app).post("/api/auth/login").send({ username: "testuser2", password: "wrong" });
      expect(res.status).toBe(400);
    });

    it("GET /api/auth/users returns user list", async () => {
      ctx.userService.createUser("user1", "pass1234", "User 1");
      const res = await request(app).get("/api/auth/users");
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("GET /api/auth/me without token returns 401 or empty", async () => {
      const res = await request(app).get("/api/auth/me");
      // Soft auth: no token → no user → 401
      expect([200, 401]).toContain(res.status);
    });
  });

  // ── Finding Groups ──

  describe("Finding Groups API", () => {
    it("GET /findings/groups?groupBy=ruleId", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-fg" }));
      ctx.runDAO.save(makeRun({ id: "r-fg", projectId: "p-fg" }));
      ctx.findingDAO.save(makeFinding({ id: "f-fg1", runId: "r-fg", projectId: "p-fg", ruleId: "rule-X" }));
      ctx.findingDAO.save(makeFinding({ id: "f-fg2", runId: "r-fg", projectId: "p-fg", ruleId: "rule-X" }));

      const res = await request(app).get("/api/projects/p-fg/findings/groups?groupBy=ruleId");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("GET /findings/groups?groupBy=location", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-fg2" }));
      ctx.runDAO.save(makeRun({ id: "r-fg2", projectId: "p-fg2" }));
      ctx.findingDAO.save(makeFinding({ id: "f-fg3", runId: "r-fg2", projectId: "p-fg2", location: "src/a.c:1" }));

      const res = await request(app).get("/api/projects/p-fg2/findings/groups?groupBy=location");
      expect(res.status).toBe(200);
    });
  });

  // ── Build Log ──

  describe("Build Log API", () => {
    it("GET /targets/:id/build-log returns log", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-bl" }));
      ctx.buildTargetDAO.save(makeBuildTarget({ id: "t-bl", projectId: "p-bl", buildLog: "make: ok" } as any));

      const res = await request(app).get("/api/projects/p-bl/targets/t-bl/build-log");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("buildLog");
    });

    it("GET /targets/:id/build-log returns 404 for unknown target", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-bl2" }));
      const res = await request(app).get("/api/projects/p-bl2/targets/nonexistent/build-log");
      expect(res.status).toBe(404);
    });
  });

  // ── Custom Report ──

  describe("Custom Report API", () => {
    it("POST /report/custom returns filtered report", async () => {
      ctx.projectDAO.save(makeProject({ id: "p-cr" }));

      const res = await request(app)
        .post("/api/projects/p-cr/report/custom")
        .send({ customization: { reportTitle: "Custom" } });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
