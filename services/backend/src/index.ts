import express from "express";
import cors from "cors";
import { config } from "./config";
import { logger } from "./lib";
import { requestIdMiddleware } from "./middleware/request-id.middleware";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware";
import { createDatabase, initSchema } from "./db";
import { createAppContext } from "./composition";
import { mountRouters } from "./router-setup";
import { runStartupTasks } from "./bootstrap";
import { attachWsServers } from "./services/ws-broadcaster";
import { createAuthMiddleware } from "./middleware/auth.middleware";

// --- 프로세스 레벨 에러 핸들러 ---
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled rejection");
});

// ── 앱 초기화 ──
const app = express();
app.use(cors({ origin: config.allowedOrigins }));
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// ── DB + DI ──
const db = createDatabase();
initSchema(db);
const ctx = createAppContext(config, db);

// ── 기동 작업 ──
runStartupTasks(ctx);

// ── 인증 미들웨어 (soft auth: AUTH_REQUIRED=false가 기본) ──
const authRequired = process.env.AUTH_REQUIRED === "true";
app.use(createAuthMiddleware(ctx.userService, authRequired));

// ── 라우터 마운트 ──
mountRouters(app, ctx);
app.use(errorHandlerMiddleware);

// ── 서버 시작 ──
const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "Core Service started");
  logger.info({
    llmGatewayUrl: config.llmGatewayUrl,
    agentUrl: config.analysisAgentUrl,
    sastUrl: config.sastRunnerUrl,
    kbUrl: config.kbUrl,
    uploadsDir: config.uploadsDir,
    allowedOrigins: config.allowedOrigins,
  }, "Configuration loaded");
});

attachWsServers(server, [
  ctx.dynamicAnalysisWs, ctx.dynamicTestWs,
  ctx.analysisWs, ctx.uploadWs, ctx.pipelineWs, ctx.notificationWs, ctx.sdkWs,
]);
