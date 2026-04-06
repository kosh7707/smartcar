import express from "express";
import type { Database as DatabaseType } from "better-sqlite3";
import type { RegisteredSdk } from "@aegis/shared";
import { createTestDb } from "./test-db";
import { errorHandlerMiddleware } from "../middleware/error-handler.middleware";

// DAOs
import { RunDAO } from "../dao/run.dao";
import { FindingDAO } from "../dao/finding.dao";
import { EvidenceRefDAO } from "../dao/evidence-ref.dao";
import { GateResultDAO } from "../dao/gate-result.dao";
import { ApprovalDAO } from "../dao/approval.dao";
import { AuditLogDAO } from "../dao/audit-log.dao";
import { AnalysisResultDAO } from "../dao/analysis-result.dao";
import { FileStore } from "../dao/file-store";
import { ProjectDAO } from "../dao/project.dao";
import { AdapterDAO } from "../dao/adapter.dao";
import { ProjectSettingsDAO } from "../dao/project-settings.dao";
import { BuildTargetDAO } from "../dao/build-target.dao";
import { SdkRegistryDAO } from "../dao/sdk-registry.dao";
import { NotificationDAO } from "../dao/notification.dao";
import { UserDAO, SessionDAO } from "../dao/user.dao";

// Services
import { FindingService } from "../services/finding.service";
import { RunService } from "../services/run.service";
import { QualityGateService } from "../services/quality-gate.service";
import { ApprovalService } from "../services/approval.service";
import { ProjectService } from "../services/project.service";
import { AdapterManager } from "../services/adapter-manager";
import { ProjectSettingsService } from "../services/project-settings.service";
import { BuildTargetService } from "../services/build-target.service";
import { ReportService } from "../services/report.service";
import { ResultNormalizer } from "../services/result-normalizer";
import { ActivityService } from "../services/activity.service";
import { NotificationService } from "../services/notification.service";
import { UserService } from "../services/user.service";

// Controllers
import { createProjectRouter } from "../controllers/project.controller";
import { createFindingRouter, createFindingDetailRouter } from "../controllers/finding.controller";
import { createRunRouter, createRunDetailRouter } from "../controllers/run.controller";
import { createQualityGateRouter, createQualityGateDetailRouter } from "../controllers/quality-gate.controller";
import { createApprovalRouter, createApprovalDetailRouter } from "../controllers/approval.controller";
import { createReportRouter } from "../controllers/report.controller";
import { createFileRouter } from "../controllers/file.controller";
import { createBuildTargetRouter } from "../controllers/build-target.controller";
import { createSdkRouter } from "../controllers/sdk.controller";
import { createPipelineRouter } from "../controllers/pipeline.controller";
import { createActivityRouter } from "../controllers/activity.controller";
import { createNotificationRouter, createNotificationDetailRouter } from "../controllers/notification.controller";
import { createAuthRouter } from "../controllers/auth.controller";
import { createGateProfileRouter } from "../controllers/project-settings.controller";
import { SDK_PROFILES } from "../services/sdk-profiles";

export interface TestAppContext {
  app: express.Express;
  db: DatabaseType;
  // DAOs exposed for seeding
  projectDAO: ProjectDAO;
  runDAO: RunDAO;
  findingDAO: FindingDAO;
  evidenceRefDAO: EvidenceRefDAO;
  gateResultDAO: GateResultDAO;
  approvalDAO: ApprovalDAO;
  auditLogDAO: AuditLogDAO;
  analysisResultDAO: AnalysisResultDAO;
  fileStore: FileStore;
  buildTargetDAO: BuildTargetDAO;
  sdkRegistryDAO: SdkRegistryDAO;
  notificationDAO: NotificationDAO;
  userDAO: UserDAO;
  sessionDAO: SessionDAO;
  // Services exposed for seeding
  gateService: QualityGateService;
  normalizer: ResultNormalizer;
  buildTargetService: BuildTargetService;
  notificationService: NotificationService;
  userService: UserService;
  settingsService: ProjectSettingsService;
  pipelineRunCalls: Array<{ projectId: string; targetIds?: string[]; requestId?: string }>;
}

export function createTestApp(): TestAppContext {
  const db = createTestDb();

  // ── Tier 0: DAOs ──
  const runDAO = new RunDAO(db);
  const findingDAO = new FindingDAO(db);
  const evidenceRefDAO = new EvidenceRefDAO(db);
  const gateResultDAO = new GateResultDAO(db);
  const approvalDAO = new ApprovalDAO(db);
  const auditLogDAO = new AuditLogDAO(db);
  const analysisResultDAO = new AnalysisResultDAO(db);
  const fileStore = new FileStore(db);
  const projectDAO = new ProjectDAO(db);
  const adapterDAO = new AdapterDAO(db);
  const projectSettingsDAO = new ProjectSettingsDAO(db);
  const buildTargetDAO = new BuildTargetDAO(db);
  const sdkRegistryDAO = new SdkRegistryDAO(db);
  const notificationDAO = new NotificationDAO(db);
  const userDAO = new UserDAO(db);
  const sessionDAO = new SessionDAO(db);

  // ── Tier 1: 기본 서비스 ──
  const adapterManager = new AdapterManager(adapterDAO);
  const settingsService = new ProjectSettingsService(projectSettingsDAO, sdkRegistryDAO);
  const buildTargetService = new BuildTargetService(buildTargetDAO, settingsService);

  // ── Tier 1.5: 알림 + 사용자 서비스 ──
  const notificationService = new NotificationService(notificationDAO);
  const userService = new UserService(userDAO, sessionDAO);
  const sdkStore = new Map<string, RegisteredSdk[]>();
  const sdkService = {
    listAll(projectId: string) {
      return {
        builtIn: SDK_PROFILES,
        registered: sdkStore.get(projectId) ?? [],
      };
    },
    findById(id: string) {
      return [...sdkStore.values()].flat().find((sdk) => sdk.id === id);
    },
    async register(
      projectId: string,
      input: { name: string; description?: string; localPath?: string },
    ) {
      const now = new Date().toISOString();
      const sdk: RegisteredSdk = {
        id: `sdk-test-${sdkStore.size + 1}`,
        projectId,
        name: input.name,
        description: input.description,
        path: input.localPath ?? `/tmp/${projectId}/sdk-upload`,
        status: "uploading",
        verified: false,
        createdAt: now,
        updatedAt: now,
      };
      const existing = sdkStore.get(projectId) ?? [];
      sdkStore.set(projectId, [...existing, sdk]);
      return sdk;
    },
    async remove(id: string) {
      for (const [projectId, items] of sdkStore.entries()) {
        const filtered = items.filter((sdk) => sdk.id !== id);
        if (filtered.length !== items.length) {
          sdkStore.set(projectId, filtered);
        }
      }
    },
  };
  const testSourceService = {
    getProjectPath(projectId: string) {
      return `/tmp/${projectId}`;
    },
    copyToSubproject(projectId: string, targetId: string) {
      return `/tmp/${projectId}/${targetId}`;
    },
  };
  const testSastClient = {
    async discoverTargets() {
      return {
        targets: [
          { name: "auto-discovered", relativePath: "auto-discovered/", buildSystem: "cmake" },
        ],
        elapsedMs: 123,
      };
    },
  };
  const pipelineRunCalls: Array<{ projectId: string; targetIds?: string[]; requestId?: string }> = [];
  const pipelineOrchestrator = {
    async runPipeline(projectId: string, targetIds?: string[], requestId?: string) {
      pipelineRunCalls.push({ projectId, targetIds, requestId });
    },
  };

  // ── Tier 2: 복합 서비스 ──
  const projectService = new ProjectService(projectDAO, analysisResultDAO, fileStore, adapterManager, settingsService, buildTargetService, findingDAO, runDAO, gateResultDAO);
  const gateService = new QualityGateService(findingDAO, evidenceRefDAO, gateResultDAO, runDAO, settingsService, notificationService);
  const normalizer = new ResultNormalizer(db, runDAO, findingDAO, evidenceRefDAO, gateService, notificationService);
  const approvalService = new ApprovalService(approvalDAO, auditLogDAO, gateService, notificationService);
  const findingService = new FindingService(findingDAO, evidenceRefDAO, auditLogDAO);
  const runService = new RunService(runDAO, findingDAO, gateResultDAO, evidenceRefDAO);
  const activityService = new ActivityService(runDAO, auditLogDAO, buildTargetDAO);
  const reportService = new ReportService(evidenceRefDAO, auditLogDAO, projectService, runService, findingService, gateService, approvalService);

  // App
  const app = express();
  app.use(express.json());

  // Mount routes matching index.ts
  app.use("/api/projects/:pid/runs", createRunRouter(runService));
  app.use("/api/projects/:pid/findings", createFindingRouter(findingService));
  app.use("/api/projects/:pid/gates", createQualityGateRouter(gateService));
  app.use("/api/projects/:pid/approvals", createApprovalRouter(approvalService));
  app.use("/api/projects/:pid/report", createReportRouter(reportService));
  app.use("/api/projects/:pid/targets", createBuildTargetRouter(buildTargetService, projectDAO, testSourceService as any, testSastClient as any));
  app.use("/api/projects/:pid/sdk", createSdkRouter(sdkService as any, projectDAO));
  app.use("/api/projects/:pid/pipeline", createPipelineRouter(pipelineOrchestrator as any, projectDAO, buildTargetDAO));
  app.use("/api/projects/:pid/activity", createActivityRouter(activityService));
  app.use("/api/projects/:pid/notifications", createNotificationRouter(notificationService));
  app.use("/api/projects", createProjectRouter(projectService));
  app.use("/api", createFileRouter(fileStore));
  app.use("/api/runs", createRunDetailRouter(runService));
  app.use("/api/findings", createFindingDetailRouter(findingService));
  app.use("/api/gates", createQualityGateDetailRouter(gateService, approvalService));
  app.use("/api/approvals", createApprovalDetailRouter(approvalService));
  app.use("/api/notifications", createNotificationDetailRouter(notificationService));
  app.use("/api/auth", createAuthRouter(userService));
  app.use("/api/gate-profiles", createGateProfileRouter());

  app.use(errorHandlerMiddleware);

  return {
    app, db,
    projectDAO, runDAO, findingDAO, evidenceRefDAO, gateResultDAO,
    approvalDAO, auditLogDAO, analysisResultDAO, fileStore,
    buildTargetDAO, sdkRegistryDAO, notificationDAO, userDAO, sessionDAO,
    gateService, normalizer, buildTargetService,
    notificationService, userService, settingsService, pipelineRunCalls,
  };
}
