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
import { createProjectSettingsRouter } from "./controllers/project-settings.controller";
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
import { createDynamicTestRouter } from "./controllers/dynamic-test.controller";
import { AdapterManager } from "./services/adapter-manager";
import { ResultNormalizer } from "./services/result-normalizer";
import { FindingService } from "./services/finding.service";
import { RunService } from "./services/run.service";
import { createRunRouter, createRunDetailRouter } from "./controllers/run.controller";
import { createFindingRouter, createFindingDetailRouter } from "./controllers/finding.controller";
import { QualityGateService } from "./services/quality-gate.service";
import { ApprovalService } from "./services/approval.service";
import { createQualityGateRouter, createQualityGateDetailRouter } from "./controllers/quality-gate.controller";
import { createApprovalRouter, createApprovalDetailRouter } from "./controllers/approval.controller";
import { ReportService } from "./services/report.service";
import { createReportRouter } from "./controllers/report.controller";

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

app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// 서비스 초기화
const llmTaskClient = new LlmTaskClient(LLM_GATEWAY_URL);
const llmAdapter = new LlmV1Adapter(llmTaskClient, 1);
const dynamicAnalysisWs = new WsBroadcaster<import("@smartcar/shared").WsMessage>("/ws/dynamic-analysis", "sessionId");
const staticAnalysisWs = new WsBroadcaster<import("@smartcar/shared").WsStaticMessage>("/ws/static-analysis", "analysisId");
const dynamicTestWs = new WsBroadcaster<import("@smartcar/shared").WsTestMessage>("/ws/dynamic-test", "testId");
const ruleService = new RuleService();
const adapterManager = new AdapterManager();
const settingsService = new ProjectSettingsService();
const projectService = new ProjectService(ruleService, adapterManager, settingsService);
const qualityGateService = new QualityGateService();
const approvalService = new ApprovalService(qualityGateService);
const resultNormalizer = new ResultNormalizer(qualityGateService);
const findingService = new FindingService();
const runService = new RunService();
const staticAnalysisService = new StaticAnalysisService(ruleService, llmAdapter, settingsService, staticAnalysisWs, resultNormalizer);

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
  canRuleEngine,
  llmAdapter,
  dynamicAnalysisWs,
  adapterManager,
  settingsService,
  resultNormalizer
);

// 동적 테스트 서비스 초기화
const dynamicTestService = new DynamicTestService(llmAdapter, adapterManager, settingsService, dynamicTestWs, resultNormalizer);

// 보고서 서비스 초기화
const reportService = new ReportService(projectService, runService, findingService, qualityGateService, approvalService);

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
app.use("/health", createHealthRouter(llmAdapter, adapterManager));
app.use("/api/projects", createProjectRouter(projectService));
app.use("/api", createFileRouter());
app.use(
  "/api/static-analysis",
  createStaticAnalysisRouter(staticAnalysisService)
);
app.use(
  "/api/dynamic-analysis",
  createDynamicAnalysisRouter(dynamicAnalysisService)
);
app.use("/api/dynamic-test", createDynamicTestRouter(dynamicTestService));
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

attachWsServers(server, [dynamicAnalysisWs, staticAnalysisWs, dynamicTestWs]);
