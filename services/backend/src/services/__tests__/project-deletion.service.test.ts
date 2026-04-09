import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { DatabaseType } from "../../db";
import { createTestDb } from "../../test/test-db";
import { ProjectDAO } from "../../dao/project.dao";
import { AnalysisResultDAO } from "../../dao/analysis-result.dao";
import { FileStore } from "../../dao/file-store";
import { DynamicSessionDAO } from "../../dao/dynamic-session.dao";
import { SdkRegistryDAO } from "../../dao/sdk-registry.dao";
import { BuildTargetDAO } from "../../dao/build-target.dao";
import { AnalysisTracker } from "../analysis-tracker";
import { ProjectSourceService } from "../project-source.service";
import { ProjectDeletionService } from "../project-deletion.service";
import { makeAnalysisResult, makeBuildTarget, makeDynamicSession, makeProject, makeStoredFile } from "../../test/factories";

describe("ProjectDeletionService", () => {
  let db: DatabaseType;
  let projectDAO: ProjectDAO;
  let analysisResultDAO: AnalysisResultDAO;
  let fileStore: FileStore;
  let dynamicSessionDAO: DynamicSessionDAO;
  let sdkRegistryDAO: SdkRegistryDAO;
  let buildTargetDAO: BuildTargetDAO;
  let analysisTracker: AnalysisTracker;
  let tmpDir: string;
  let sourceService: ProjectSourceService;
  let adapterManager: { findByProjectId: ReturnType<typeof vi.fn> };
  let dynamicTestService: { isRunningForProject: ReturnType<typeof vi.fn> };
  let service: ProjectDeletionService;

  beforeEach(() => {
    db = createTestDb();
    projectDAO = new ProjectDAO(db);
    analysisResultDAO = new AnalysisResultDAO(db);
    fileStore = new FileStore(db);
    dynamicSessionDAO = new DynamicSessionDAO(db);
    sdkRegistryDAO = new SdkRegistryDAO(db);
    buildTargetDAO = new BuildTargetDAO(db);
    analysisTracker = new AnalysisTracker();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-project-delete-service-"));
    sourceService = new ProjectSourceService(tmpDir);
    adapterManager = { findByProjectId: vi.fn(() => []) };
    dynamicTestService = { isRunningForProject: vi.fn(() => false) };
    service = new ProjectDeletionService(
      db,
      sourceService,
      adapterManager as any,
      analysisTracker,
      dynamicSessionDAO,
      dynamicTestService as any,
      sdkRegistryDAO,
      buildTargetDAO,
    );
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("deletes project-scoped rows and removes the uploads root", async () => {
    projectDAO.save(makeProject({ id: "p-delete", name: "Delete Me" }));
    analysisResultDAO.save(makeAnalysisResult({ id: "analysis-delete", projectId: "p-delete" }));
    fileStore.save(makeStoredFile({ id: "file-delete", projectId: "p-delete", name: "main.c" }));
    dynamicSessionDAO.save(makeDynamicSession({ id: "dyn-delete", projectId: "p-delete", status: "stopped" }));
    sdkRegistryDAO.save({
      id: "sdk-delete",
      projectId: "p-delete",
      name: "SDK",
      path: "/tmp/sdk-delete",
      status: "ready",
      verified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    buildTargetDAO.save(makeBuildTarget({ id: "target-delete", projectId: "p-delete", status: "ready" }));

    const projectRoot = path.join(tmpDir, "p-delete");
    fs.mkdirSync(path.join(projectRoot, "sdk", "sdk-delete"), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, "main.c"), "int main() { return 0; }");

    await service.deleteProject("p-delete");

    expect(projectDAO.findById("p-delete")).toBeUndefined();
    expect(fileStore.findByProjectId("p-delete")).toHaveLength(0);
    expect(analysisResultDAO.findByProjectId("p-delete")).toHaveLength(0);
    expect(dynamicSessionDAO.findByProjectId("p-delete")).toHaveLength(0);
    expect(sdkRegistryDAO.findByProjectId("p-delete")).toHaveLength(0);
    expect(buildTargetDAO.findByProjectId("p-delete")).toHaveLength(0);
    expect(fs.existsSync(projectRoot)).toBe(false);
  });

  it("blocks deletion when an analysis is running", async () => {
    projectDAO.save(makeProject({ id: "p-block-analysis" }));
    const projectRoot = path.join(tmpDir, "p-block-analysis");
    fs.mkdirSync(projectRoot, { recursive: true });

    analysisTracker.start("analysis-1", "p-block-analysis");

    await expect(service.deleteProject("p-block-analysis")).rejects.toMatchObject({
      code: "CONFLICT",
      details: {
        blockers: {
          activeAnalysis: { analysisId: "analysis-1" },
        },
      },
    });
    expect(fs.existsSync(projectRoot)).toBe(true);
  });

  it("restores the quarantined uploads root when DB deletion fails", async () => {
    projectDAO.save(makeProject({ id: "p-restore" }));
    const projectRoot = path.join(tmpDir, "p-restore");
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(path.join(projectRoot, "keep.txt"), "restore me");

    const prepareSpy = vi.spyOn(db, "prepare");
    const originalPrepare = db.prepare.bind(db);
    prepareSpy.mockImplementation(((sql: string) => {
      if (sql === "DELETE FROM projects WHERE id = ?") {
        return {
          run() {
            throw new Error("forced-db-delete-failure");
          },
        } as any;
      }
      return originalPrepare(sql);
    }) as typeof db.prepare);

    await expect(service.deleteProject("p-restore")).rejects.toMatchObject({
      code: "DB_ERROR",
    });

    expect(projectDAO.findById("p-restore")).toBeDefined();
    expect(fs.existsSync(projectRoot)).toBe(true);
    expect(fs.readFileSync(path.join(projectRoot, "keep.txt"), "utf-8")).toBe("restore me");
  });
});
