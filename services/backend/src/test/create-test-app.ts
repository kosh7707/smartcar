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
import { RuleDAO } from "../dao/rule.dao";
import { AdapterDAO } from "../dao/adapter.dao";
import { ProjectSettingsDAO } from "../dao/project-settings.dao";
import { BuildTargetDAO } from "../dao/build-target.dao";

// Services
import { FindingService } from "../services/finding.service";
import { RunService } from "../services/run.service";
import { QualityGateService } from "../services/quality-gate.service";
import { ApprovalService } from "../services/approval.service";
import { ProjectService } from "../services/project.service";
import { RuleService } from "../services/rule.service";
import { AdapterManager } from "../services/adapter-manager";
import { ProjectSettingsService } from "../services/project-settings.service";
import { BuildTargetService } from "../services/build-target.service";
import { ReportService } from "../services/report.service";
import { ResultNormalizer } from "../services/result-normalizer";

// Controllers
import { createProjectRouter } from "../controllers/project.controller";
import { createFindingRouter, createFindingDetailRouter } from "../controllers/finding.controller";
import { createRunRouter, createRunDetailRouter } from "../controllers/run.controller";
import { createQualityGateRouter, createQualityGateDetailRouter } from "../controllers/quality-gate.controller";
import { createApprovalRouter, createApprovalDetailRouter } from "../controllers/approval.controller";
import { createReportRouter } from "../controllers/report.controller";
import { createFileRouter } from "../controllers/file.controller";
import { createBuildTargetRouter } from "../controllers/build-target.controller";

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
  ruleDAO: RuleDAO;
  buildTargetDAO: BuildTargetDAO;
  // Services exposed for seeding
  gateService: QualityGateService;
  normalizer: ResultNormalizer;
  buildTargetService: BuildTargetService;
}

export function createTestApp(): TestAppContext {
  const db = createTestDb();

  // DAOs
  const runDAO = new RunDAO(db);
  const findingDAO = new FindingDAO(db);
  const evidenceRefDAO = new EvidenceRefDAO(db);
  const gateResultDAO = new GateResultDAO(db);
  const approvalDAO = new ApprovalDAO(db);
  const auditLogDAO = new AuditLogDAO(db);
  const analysisResultDAO = new AnalysisResultDAO(db);
  const fileStore = new FileStore(db);
  const projectDAO = new ProjectDAO(db);
  const ruleDAO = new RuleDAO(db);
  const adapterDAO = new AdapterDAO(db);
  const projectSettingsDAO = new ProjectSettingsDAO(db);
  const buildTargetDAO = new BuildTargetDAO(db);

  // Services
  const ruleService = new RuleService(ruleDAO);
  const adapterManager = new AdapterManager(adapterDAO);
  const settingsService = new ProjectSettingsService(projectSettingsDAO);
  const buildTargetService = new BuildTargetService(buildTargetDAO, settingsService);
  const projectService = new ProjectService(projectDAO, analysisResultDAO, fileStore, ruleService, adapterManager, settingsService, buildTargetService);
  const gateService = new QualityGateService(findingDAO, evidenceRefDAO, gateResultDAO, runDAO);
  const normalizer = new ResultNormalizer(db, runDAO, findingDAO, evidenceRefDAO, gateService);
  const approvalService = new ApprovalService(approvalDAO, auditLogDAO, gateService);
  const findingService = new FindingService(findingDAO, evidenceRefDAO, auditLogDAO);
  const runService = new RunService(runDAO, findingDAO, gateResultDAO, evidenceRefDAO);
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
  app.use("/api/projects", createProjectRouter(projectService));
  app.use("/api", createFileRouter(fileStore));
  app.use("/api/runs", createRunDetailRouter(runService));
  app.use("/api/findings", createFindingDetailRouter(findingService));
  app.use("/api/gates", createQualityGateDetailRouter(gateService, approvalService));
  app.use("/api/approvals", createApprovalDetailRouter(approvalService));

  app.use(errorHandlerMiddleware);

  return {
    app, db,
    projectDAO, runDAO, findingDAO, evidenceRefDAO, gateResultDAO,
    approvalDAO, auditLogDAO, analysisResultDAO, fileStore, ruleDAO,
    buildTargetDAO,
    gateService, normalizer, buildTargetService,
  };
}
