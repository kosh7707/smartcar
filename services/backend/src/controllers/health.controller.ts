import { Router } from "express";
import { LlmClient } from "../services/llm-client";
import type { AdapterManager } from "../services/adapter-manager";

export function createHealthRouter(
  llmClient: LlmClient,
  adapterManager: AdapterManager
): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
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
  });

  return router;
}
