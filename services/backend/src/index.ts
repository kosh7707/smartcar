import express from "express";
import cors from "cors";
import { logger, generateRequestId } from "./lib";
import { requestIdMiddleware } from "./middleware/request-id.middleware";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware";
import { createHealthRouter } from "./controllers/health.controller";
import { createStaticAnalysisRouter } from "./controllers/static-analysis.controller";
import { createProjectRouter } from "./controllers/project.controller";
import { createFileRouter } from "./controllers/file.controller";
import { createDynamicAnalysisRouter } from "./controllers/dynamic-analysis.controller";
import { createProjectAdaptersRouter } from "./controllers/project-adapters.controller";
import { createProjectRulesRouter } from "./controllers/project-rules.controller";
import { createProjectSettingsRouter, createSdkProfileRouter } from "./controllers/project-settings.controller";
import { createDynamicTestRouter } from "./controllers/dynamic-test.controller";
import { createRunRouter, createRunDetailRouter } from "./controllers/run.controller";
import { createFindingRouter, createFindingDetailRouter } from "./controllers/finding.controller";
import { createQualityGateRouter, createQualityGateDetailRouter } from "./controllers/quality-gate.controller";
import { createApprovalRouter, createApprovalDetailRouter } from "./controllers/approval.controller";
import { createReportRouter } from "./controllers/report.controller";

// DB + Schema
import { createDatabase, initSchema } from "./db";

// DAO classes
import { RunDAO } from "./dao/run.dao";
import { FindingDAO } from "./dao/finding.dao";
import { EvidenceRefDAO } from "./dao/evidence-ref.dao";
import { GateResultDAO } from "./dao/gate-result.dao";
import { ApprovalDAO } from "./dao/approval.dao";
import { AuditLogDAO } from "./dao/audit-log.dao";
import { AnalysisResultDAO } from "./dao/analysis-result.dao";
import { FileStore } from "./dao/file-store";
import { DynamicSessionDAO } from "./dao/dynamic-session.dao";
import { DynamicAlertDAO } from "./dao/dynamic-alert.dao";
import { DynamicMessageDAO } from "./dao/dynamic-message.dao";
import { DynamicTestResultDAO } from "./dao/dynamic-test-result.dao";
import { ProjectDAO } from "./dao/project.dao";
import { RuleDAO } from "./dao/rule.dao";
import { AdapterDAO } from "./dao/adapter.dao";
import { ProjectSettingsDAO } from "./dao/project-settings.dao";
import { BuildTargetDAO } from "./dao/build-target.dao";

// Service classes
import { ProjectSettingsService } from "./services/project-settings.service";
import { StaticAnalysisService } from "./services/static-analysis.service";
import { ProjectService } from "./services/project.service";
import { RuleService } from "./services/rule.service";
import { LlmTaskClient } from "./services/llm-task-client";
import { LlmV1Adapter } from "./services/llm-v1-adapter";
import { CanRuleEngine } from "./can-rules/can-rule-engine";
import { FrequencyRule } from "./can-rules/frequency-rule";
import { UnauthorizedIdRule } from "./can-rules/unauthorized-id-rule";
import { AttackSignatureRule } from "./can-rules/attack-signature-rule";
import { WsBroadcaster, attachWsServers } from "./services/ws-broadcaster";
import { DynamicAnalysisService } from "./services/dynamic-analysis.service";
import { DynamicTestService } from "./services/dynamic-test.service";
import { AdapterManager } from "./services/adapter-manager";
import { ResultNormalizer } from "./services/result-normalizer";
import { FindingService } from "./services/finding.service";
import { RunService } from "./services/run.service";
import { QualityGateService } from "./services/quality-gate.service";
import { ApprovalService } from "./services/approval.service";
import { ReportService } from "./services/report.service";
import { AnalysisTracker } from "./services/analysis-tracker";
import { SastClient } from "./services/sast-client";
import { AgentClient } from "./services/agent-client";
import { ProjectSourceService } from "./services/project-source.service";
import { AnalysisOrchestrator } from "./services/analysis-orchestrator";
import { BuildTargetService } from "./services/build-target.service";
import { KbClient } from "./services/kb-client";
import { PipelineOrchestrator } from "./services/pipeline-orchestrator";
import { createAnalysisRouter } from "./controllers/analysis.controller";
import { createProjectSourceRouter } from "./controllers/project-source.controller";
import { createBuildTargetRouter } from "./controllers/build-target.controller";
import { createPipelineRouter } from "./controllers/pipeline.controller";
import path from "path";

// --- 프로세스 레벨 에러 핸들러 ---
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled rejection");
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const LLM_GATEWAY_URL =
  process.env.LLM_GATEWAY_URL ?? "http://localhost:8000";
const LLM_CONCURRENCY = Number(process.env.LLM_CONCURRENCY) || 4;
const ANALYSIS_AGENT_URL =
  process.env.ANALYSIS_AGENT_URL ?? "http://localhost:8001";
const SAST_RUNNER_URL =
  process.env.SAST_RUNNER_URL ?? "http://localhost:9000";
const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR ?? path.join(__dirname, "..", "..", "..", "uploads"),
);
const KB_URL = process.env.KB_URL ?? "http://localhost:8002";

app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// ── DB 초기화 ──
const db = createDatabase();
initSchema(db);

// ── DAO 생성 ──
const runDAO = new RunDAO(db);
const findingDAO = new FindingDAO(db);
const evidenceRefDAO = new EvidenceRefDAO(db);
const gateResultDAO = new GateResultDAO(db);
const approvalDAO = new ApprovalDAO(db);
const auditLogDAO = new AuditLogDAO(db);
const analysisResultDAO = new AnalysisResultDAO(db);
const fileStore = new FileStore(db);
const dynamicSessionDAO = new DynamicSessionDAO(db);
const dynamicAlertDAO = new DynamicAlertDAO(db);
const dynamicMessageDAO = new DynamicMessageDAO(db);
const dynamicTestResultDAO = new DynamicTestResultDAO(db);
const projectDAO = new ProjectDAO(db);
const ruleDAO = new RuleDAO(db);
const adapterDAO = new AdapterDAO(db);
const projectSettingsDAO = new ProjectSettingsDAO(db);
const buildTargetDAO = new BuildTargetDAO(db);

// ── 서비스 초기화 ──
const llmTaskClient = new LlmTaskClient(LLM_GATEWAY_URL);
const llmAdapter = new LlmV1Adapter(llmTaskClient, LLM_CONCURRENCY);
const dynamicAnalysisWs = new WsBroadcaster<import("@aegis/shared").WsMessage>("/ws/dynamic-analysis", "sessionId");
const staticAnalysisWs = new WsBroadcaster<import("@aegis/shared").WsStaticMessage>("/ws/static-analysis", "analysisId");
const dynamicTestWs = new WsBroadcaster<import("@aegis/shared").WsTestMessage>("/ws/dynamic-test", "testId");

const ruleService = new RuleService(ruleDAO);
const adapterManager = new AdapterManager(adapterDAO);
const settingsService = new ProjectSettingsService(projectSettingsDAO);
// projectSourceService를 먼저 생성 (buildTargetService가 물리적 복사에 의존)
const projectSourceService = new ProjectSourceService(UPLOADS_DIR);
const buildTargetService = new BuildTargetService(buildTargetDAO, settingsService, projectSourceService);
const projectService = new ProjectService(projectDAO, analysisResultDAO, fileStore, ruleService, adapterManager, settingsService, buildTargetService);

const qualityGateService = new QualityGateService(findingDAO, evidenceRefDAO, gateResultDAO, runDAO);
const resultNormalizer = new ResultNormalizer(db, runDAO, findingDAO, evidenceRefDAO, qualityGateService);

const approvalService = new ApprovalService(approvalDAO, auditLogDAO, qualityGateService);
const findingService = new FindingService(findingDAO, evidenceRefDAO, auditLogDAO);
const runService = new RunService(runDAO, findingDAO, gateResultDAO, evidenceRefDAO);

const staticAnalysisService = new StaticAnalysisService(
  fileStore, analysisResultDAO, ruleService, llmAdapter, settingsService, staticAnalysisWs, resultNormalizer
);

// 기존 프로젝트에 기본 룰 시딩 (1회 마이그레이션)
const seedRequestId = generateRequestId("sys");
logger.info({ requestId: seedRequestId }, "Rule seeding check started");
for (const project of projectService.findAll()) {
  const rules = ruleService.findByProjectId(project.id);
  if (rules.length === 0) {
    ruleService.seedDefaultRules(project.id);
    logger.info({ requestId: seedRequestId, projectId: project.id, projectName: project.name }, "기본 룰 시딩 완료");
  }
}

// 동적 분석 CAN 룰 엔진 초기화
const canRuleEngine = new CanRuleEngine();
canRuleEngine.registerRule(new FrequencyRule());
canRuleEngine.registerRule(new UnauthorizedIdRule());
canRuleEngine.registerRule(new AttackSignatureRule());

// 동적 분석 서비스 초기화
const dynamicAnalysisService = new DynamicAnalysisService(
  dynamicSessionDAO, dynamicAlertDAO, dynamicMessageDAO, analysisResultDAO,
  canRuleEngine, llmAdapter, dynamicAnalysisWs, adapterManager, settingsService, resultNormalizer
);

// 동적 테스트 서비스 초기화
const dynamicTestService = new DynamicTestService(
  dynamicTestResultDAO, analysisResultDAO,
  llmAdapter, adapterManager, settingsService, dynamicTestWs, resultNormalizer
);

// ── 새 파이프라인 (Quick → Deep) ──
const analysisWs = new WsBroadcaster<import("@aegis/shared").WsAnalysisMessage>("/ws/analysis", "analysisId");
const uploadWs = new WsBroadcaster<import("@aegis/shared").WsUploadMessage>("/ws/upload", "uploadId");
const pipelineWs = new WsBroadcaster<import("@aegis/shared").WsPipelineMessage>("/ws/pipeline", "projectId");
const sastClient = new SastClient(SAST_RUNNER_URL);
const agentClient = new AgentClient(ANALYSIS_AGENT_URL);
// projectSourceService, buildTargetService는 위에서 이미 생성됨
const analysisTracker = new AnalysisTracker();
const kbClient = new KbClient(KB_URL);
const analysisOrchestrator = new AnalysisOrchestrator(
  projectSourceService, sastClient, agentClient,
  analysisResultDAO, settingsService, resultNormalizer, analysisWs, buildTargetService,
);
const pipelineOrchestrator = new PipelineOrchestrator(
  projectSourceService, sastClient, kbClient,
  buildTargetDAO, analysisResultDAO, resultNormalizer, pipelineWs,
);

// 보고서 서비스 초기화
const reportService = new ReportService(
  evidenceRefDAO, auditLogDAO,
  projectService, runService, findingService, qualityGateService, approvalService
);

// 라우터 마운트 — 프로젝트 스코프 (신규)
app.use("/api/projects/:pid/adapters", createProjectAdaptersRouter(adapterManager));
app.use("/api/projects/:pid/rules", createProjectRulesRouter(ruleService));
app.use("/api/projects/:pid/settings", createProjectSettingsRouter(settingsService));
app.use("/api/projects/:pid/runs", createRunRouter(runService));
app.use("/api/projects/:pid/findings", createFindingRouter(findingService));
app.use("/api/projects/:pid/gates", createQualityGateRouter(qualityGateService));
app.use("/api/projects/:pid/approvals", createApprovalRouter(approvalService));
app.use("/api/projects/:pid/report", createReportRouter(reportService));

// 라우터 마운트
app.use("/api/sdk-profiles", createSdkProfileRouter());
app.use("/health", createHealthRouter(llmAdapter, adapterManager, agentClient, sastClient));
app.use("/api/projects", createProjectRouter(projectService));
app.use("/api", createFileRouter(fileStore));
app.use(
  "/api/static-analysis",
  createStaticAnalysisRouter(staticAnalysisService, fileStore, analysisResultDAO, findingDAO, runDAO, gateResultDAO)
);
app.use(
  "/api/dynamic-analysis",
  createDynamicAnalysisRouter(dynamicAnalysisService)
);
app.use("/api/dynamic-test", createDynamicTestRouter(dynamicTestService));
app.use("/api/analysis", createAnalysisRouter(analysisOrchestrator, analysisResultDAO, analysisTracker, findingDAO, runDAO, gateResultDAO, agentClient, projectSourceService));
app.use("/api/projects/:pid/source", createProjectSourceRouter(projectSourceService, projectDAO, uploadWs));
app.use("/api/projects/:pid/targets", createBuildTargetRouter(buildTargetService, projectDAO, projectSourceService, sastClient));
app.use("/api/projects/:pid/pipeline", createPipelineRouter(pipelineOrchestrator, projectDAO, buildTargetDAO));
app.use("/api/runs", createRunDetailRouter(runService));
app.use("/api/findings", createFindingDetailRouter(findingService));
app.use("/api/gates", createQualityGateDetailRouter(qualityGateService, approvalService));
app.use("/api/approvals", createApprovalDetailRouter(approvalService));

// 글로벌 에러 핸들러 (모든 라우터 뒤에 마운트)
app.use(errorHandlerMiddleware);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "Core Service started");
  logger.info({ llmGatewayUrl: LLM_GATEWAY_URL }, "LLM Gateway configured");
});

attachWsServers(server, [dynamicAnalysisWs, staticAnalysisWs, dynamicTestWs, analysisWs, uploadWs, pipelineWs]);
