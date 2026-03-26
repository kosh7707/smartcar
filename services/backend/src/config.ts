import path from "path";

export interface AppConfig {
  port: number;
  allowedOrigins: string[];
  llmGatewayUrl: string;
  llmConcurrency: number;
  analysisAgentUrl: string;
  sastRunnerUrl: string;
  uploadsDir: string;
  kbUrl: string;
  buildAgentUrl: string;
  dbPath: string;
  logDir: string;
  logLevel: string;
}

function parseOrigins(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export const config: AppConfig = Object.freeze({
  port: Number(process.env.PORT) || 3000,
  allowedOrigins: parseOrigins(
    process.env.ALLOWED_ORIGINS ?? "http://localhost:5173",
  ),
  llmGatewayUrl: process.env.LLM_GATEWAY_URL ?? "http://localhost:8000",
  llmConcurrency: Number(process.env.LLM_CONCURRENCY) || 4,
  analysisAgentUrl:
    process.env.ANALYSIS_AGENT_URL ?? "http://localhost:8001",
  sastRunnerUrl: process.env.SAST_RUNNER_URL ?? "http://localhost:9000",
  uploadsDir: path.resolve(
    process.env.UPLOADS_DIR ?? path.join(__dirname, "..", "..", "..", "uploads"),
  ),
  kbUrl: process.env.KB_URL ?? "http://localhost:8002",
  buildAgentUrl: process.env.BUILD_AGENT_URL ?? "http://localhost:8003",
  dbPath:
    process.env.DB_PATH ?? path.join(__dirname, "..", "aegis.db"),
  logDir:
    process.env.LOG_DIR ?? path.resolve(__dirname, "../../../../logs"),
  logLevel: process.env.LOG_LEVEL ?? "info",
});
