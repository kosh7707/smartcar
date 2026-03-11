import express from "express";
import cors from "cors";
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

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const LLM_GATEWAY_URL =
  process.env.LLM_GATEWAY_URL ?? "http://localhost:8000";

app.use(cors());
app.use(express.json());

// 서비스 초기화
const llmClient = new LlmClient(LLM_GATEWAY_URL);
const wsManager = new WsManager();
const ruleService = new RuleService();
const adapterManager = new AdapterManager();
const settingsService = new ProjectSettingsService();
const projectService = new ProjectService(ruleService, adapterManager, settingsService);
const staticAnalysisService = new StaticAnalysisService(ruleService, llmClient, settingsService, wsManager);

// 기존 프로젝트에 기본 룰 시딩 (1회 마이그레이션)
for (const project of projectService.findAll()) {
  const rules = ruleService.findByProjectId(project.id);
  if (rules.length === 0) {
    ruleService.seedDefaultRules(project.id);
    console.log(`[Core Service] 기본 룰 시딩: ${project.name} (${project.id})`);
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

const server = app.listen(PORT, () => {
  console.log(`[Core Service] http://localhost:${PORT}`);
  console.log(`[Core Service] LLM Gateway: ${LLM_GATEWAY_URL}`);
});

wsManager.attach(server);
