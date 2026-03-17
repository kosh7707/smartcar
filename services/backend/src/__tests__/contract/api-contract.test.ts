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
});
