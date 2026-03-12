import { Router, type Request } from "express";
import type { AttackScenarioId } from "@smartcar/shared";
import { DynamicAnalysisService } from "../services/dynamic-analysis.service";
import { asyncHandler } from "../middleware/async-handler";

export function createDynamicAnalysisRouter(
  service: DynamicAnalysisService
): Router {
  const router = Router();

  // 세션 생성
  router.post("/sessions", asyncHandler(async (req, res) => {
    const { projectId, adapterId } = req.body as { projectId?: string; adapterId?: string };
    if (!projectId) {
      res.status(400).json({ success: false, error: "projectId is required" });
      return;
    }
    if (!adapterId) {
      res.status(400).json({ success: false, error: "adapterId is required" });
      return;
    }
    const session = service.createSession(projectId, adapterId);
    res.status(201).json({ success: true, data: session });
  }));

  // 세션 목록
  router.get("/sessions", (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    const sessions = service.findAllSessions(projectId);
    res.json({ success: true, data: sessions });
  });

  // 세션 상세
  router.get("/sessions/:id", (req, res) => {
    const result = service.findSession(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }
    res.json({ success: true, data: result });
  });

  // 모니터링 시작
  router.post("/sessions/:id/start", (req, res) => {
    const session = service.startSession(req.params.id);
    if (!session) {
      res.status(400).json({
        success: false,
        error: "Session not found or not in 'connected' status",
      });
      return;
    }
    res.json({ success: true, data: session });
  });

  // 세션 종료
  router.delete("/sessions/:id", asyncHandler(async (req: Request<{ id: string }>, res) => {
    const session = await service.stopSession(req.params.id, req.requestId);
    if (!session) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }
    res.json({ success: true, data: session });
  }));

  // --- CAN 주입 ---

  // 사전정의 시나리오 목록
  router.get("/scenarios", (_req, res) => {
    const scenarios = DynamicAnalysisService.getAttackScenarios();
    res.json({ success: true, data: scenarios });
  });

  // CAN 메시지 단일 주입
  router.post("/sessions/:id/inject", asyncHandler(async (req: Request<{ id: string }>, res) => {
    const { canId, dlc, data, label } = req.body as {
      canId?: string; dlc?: number; data?: string; label?: string;
    };
    if (!canId) {
      res.status(400).json({ success: false, error: "canId is required" });
      return;
    }
    if (dlc === undefined || dlc === null || dlc < 0 || dlc > 8) {
      res.status(400).json({ success: false, error: "dlc must be 0-8" });
      return;
    }
    if (!data) {
      res.status(400).json({ success: false, error: "data is required" });
      return;
    }
    const result = await service.injectMessage(req.params.id, { canId, dlc, data, label });
    res.json({ success: true, data: result });
  }));

  // 사전정의 시나리오 실행
  router.post("/sessions/:id/inject-scenario", asyncHandler(async (req: Request<{ id: string }>, res) => {
    const { scenarioId } = req.body as { scenarioId?: string };
    if (!scenarioId) {
      res.status(400).json({ success: false, error: "scenarioId is required" });
      return;
    }
    const results = await service.injectScenario(req.params.id, scenarioId as AttackScenarioId);
    res.json({ success: true, data: results });
  }));

  // 주입 이력 조회
  router.get("/sessions/:id/injections", (req, res) => {
    const history = service.getInjectionHistory(req.params.id);
    res.json({ success: true, data: history });
  });

  return router;
}
