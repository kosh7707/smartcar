import { Router } from "express";
import type { LlmV1Adapter } from "../services/llm-v1-adapter";
import type { AdapterManager } from "../services/adapter-manager";
import type { AgentClient } from "../services/agent-client";
import type { SastClient } from "../services/sast-client";
import type { KbClient } from "../services/kb-client";
import type { BuildAgentClient } from "../services/build-agent-client";
import { asyncHandler } from "../middleware/async-handler";

type ServiceStatus = "ok" | "unreachable";
type OverallStatus = "ok" | "degraded" | "unhealthy";

interface ServiceHealth {
  status: ServiceStatus;
  detail?: Record<string, unknown>;
}

export function createHealthRouter(
  llmClient: LlmV1Adapter,
  adapterManager: AdapterManager,
  agentClient?: AgentClient,
  sastClient?: SastClient,
  kbClient?: KbClient,
  buildAgentClient?: BuildAgentClient,
): Router {
  const router = Router();

  router.get("/", asyncHandler(async (_req, res) => {
    const [llmHealth, agentHealth, sastHealth, kbHealth, buildAgentHealth] = await Promise.all([
      llmClient.checkHealth().catch(() => null),
      agentClient?.checkHealth().catch(() => null) ?? null,
      sastClient?.checkHealth().catch(() => null) ?? null,
      kbClient?.checkHealth().catch(() => null) ?? null,
      buildAgentClient?.checkHealth().catch(() => null) ?? null,
    ]);

    const adapters = adapterManager.findAll();
    const connectedCount = adapters.filter((a) => a.connected).length;

    const services: Record<string, ServiceHealth> = {
      llmGateway: toServiceHealth(llmHealth),
      analysisAgent: toServiceHealth(agentHealth),
      sastRunner: toServiceHealth(sastHealth),
      knowledgeBase: toServiceHealth(kbHealth),
      buildAgent: toServiceHealth(buildAgentHealth),
    };

    // 종합 판정:
    // - 핵심 서비스(SAST, Agent) 모두 ok → "ok"
    // - 일부 unreachable → "degraded"
    // - 핵심 서비스(SAST + Agent) 모두 unreachable → "unhealthy"
    const coreServices = [services.sastRunner, services.analysisAgent];
    const allServices = Object.values(services);
    const coreDown = coreServices.every((s) => s.status === "unreachable");
    const anyDown = allServices.some((s) => s.status === "unreachable");

    let status: OverallStatus;
    if (coreDown) status = "unhealthy";
    else if (anyDown) status = "degraded";
    else status = "ok";

    res.json({
      service: "aegis-core-service",
      status,
      version: "0.2.0",
      ...services,
      adapters: {
        total: adapters.length,
        connected: connectedCount,
      },
    });
  }));

  return router;
}

function toServiceHealth(data: Record<string, unknown> | null): ServiceHealth {
  if (!data) return { status: "unreachable" };
  return { status: "ok", detail: data };
}
