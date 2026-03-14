import { Router } from "express";
import type { LlmV1Adapter } from "../services/llm-v1-adapter";
import type { AdapterManager } from "../services/adapter-manager";
import { asyncHandler } from "../middleware/async-handler";

export function createHealthRouter(
  llmClient: LlmV1Adapter,
  adapterManager: AdapterManager
): Router {
  const router = Router();

  router.get("/", asyncHandler(async (_req, res) => {
    const llmHealth = await llmClient.checkHealth();
    const adapters = adapterManager.findAll();
    const connectedCount = adapters.filter((a) => a.connected).length;

    res.json({
      service: "smartcar-core-service",
      status: "ok",
      version: "0.1.0",
      llmGateway: llmHealth ?? { status: "unreachable" },
      adapters: {
        total: adapters.length,
        connected: connectedCount,
      },
    });
  }));

  return router;
}
