import { Router } from "express";
import type { LlmV1Adapter } from "../services/llm-v1-adapter";
import type { AdapterManager } from "../services/adapter-manager";
import type { AgentClient } from "../services/agent-client";
import type { SastClient } from "../services/sast-client";
import { asyncHandler } from "../middleware/async-handler";

export function createHealthRouter(
  llmClient: LlmV1Adapter,
  adapterManager: AdapterManager,
  agentClient?: AgentClient,
  sastClient?: SastClient,
): Router {
  const router = Router();

  router.get("/", asyncHandler(async (_req, res) => {
    const [llmHealth, agentHealth, sastHealth] = await Promise.all([
      llmClient.checkHealth().catch(() => null),
      agentClient?.checkHealth().catch(() => null) ?? null,
      sastClient?.checkHealth().catch(() => null) ?? null,
    ]);
    const adapters = adapterManager.findAll();
    const connectedCount = adapters.filter((a) => a.connected).length;

    res.json({
      service: "aegis-core-service",
      status: "ok",
      version: "0.2.0",
      llmGateway: llmHealth ?? { status: "unreachable" },
      analysisAgent: agentHealth ?? { status: "unreachable" },
      sastRunner: sastHealth ?? { status: "unreachable" },
      adapters: {
        total: adapters.length,
        connected: connectedCount,
      },
    });
  }));

  return router;
}
