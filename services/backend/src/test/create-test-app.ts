import express from "express";
import type { Database as DatabaseType } from "better-sqlite3";
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
import { createPipelineRouter } from "../controllers/pipeline.controller";
import { createActivityRouter } from "../controllers/activity.controller";
import { createNotificationRouter, createNotificationDetailRouter } from "../controllers/notification.controller";
import { createAuthRouter } from "../controllers/auth.controller";
import { createGateProfileRouter } from "../controllers/project-settings.controller";

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
  app.use("/api/projects/:pid/targets", createBuildTargetRouter(buildTargetService, projectDAO, null as any, null));
  app.use("/api/projects/:pid/pipeline", createPipelineRouter(null as any, projectDAO, buildTargetDAO));
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
    buildTargetDAO, notificationDAO, userDAO, sessionDAO,
    gateService, normalizer, buildTargetService,
    notificationService, userService, settingsService,
  };
}
