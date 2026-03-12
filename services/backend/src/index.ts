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
import { LlmClient } from "./services/llm-client";
import { CanRuleEngine } from "./can-rules/can-rule-engine";
import { FrequencyRule } from "./can-rules/frequency-rule";
import { UnauthorizedIdRule } from "./can-rules/unauthorized-id-rule";
import { AttackSignatureRule } from "./can-rules/attack-signature-rule";
import { WsManager } from "./services/ws-manager";
import { DynamicAnalysisService } from "./services/dynamic-analysis.service";
import { DynamicTestService } from "./services/dynamic-test.service";
import { createDynamicTestRouter } from "./controllers/dynamic-test.controller";
import { AdapterManager } from "./services/adapter-manager";

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
const llmClient = new LlmClient(LLM_GATEWAY_URL);
const wsManager = new WsManager();
const ruleService = new RuleService();
const adapterManager = new AdapterManager();
const settingsService = new ProjectSettingsService();
const projectService = new ProjectService(ruleService, adapterManager, settingsService);
const staticAnalysisService = new StaticAnalysisService(ruleService, llmClient, settingsService, wsManager);

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
  llmClient,
  wsManager,
  adapterManager,
  settingsService
);

// 동적 테스트 서비스 초기화
const dynamicTestService = new DynamicTestService(llmClient, adapterManager, settingsService, wsManager);

// 라우터 마운트 — 프로젝트 스코프 (신규)
app.use("/api/projects/:pid/adapters", createProjectAdaptersRouter(adapterManager));
app.use("/api/projects/:pid/rules", createProjectRulesRouter(ruleService));
app.use("/api/projects/:pid/settings", createProjectSettingsRouter(settingsService));

// 라우터 마운트
app.use("/health", createHealthRouter(llmClient, adapterManager));
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

// 글로벌 에러 핸들러 (모든 라우터 뒤에 마운트)
app.use(errorHandlerMiddleware);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "Core Service started");
  logger.info({ llmGatewayUrl: LLM_GATEWAY_URL }, "LLM Gateway configured");
});

wsManager.attach(server);
