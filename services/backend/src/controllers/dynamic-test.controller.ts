import { Router } from "express";
import type { DynamicTestConfig } from "@aegis/shared";
import { DynamicTestService } from "../services/dynamic-test.service";
import { asyncHandler } from "../middleware/async-handler";

const VALID_TEST_TYPES = ["fuzzing", "pentest"];
const VALID_STRATEGIES = ["random", "boundary", "scenario"];

export function createDynamicTestRouter(service: DynamicTestService): Router {
  const router = Router();

  // 테스트 실행
  router.post("/run", asyncHandler(async (req, res) => {
    const { projectId, config, adapterId, testId } = req.body as {
      projectId?: string;
      config?: DynamicTestConfig;
      adapterId?: string;
      testId?: string;
    };

    if (!projectId) {
      res.status(400).json({ success: false, error: "projectId is required" });
      return;
    }
    if (!adapterId) {
      res.status(400).json({ success: false, error: "adapterId is required" });
      return;
    }
    if (!config) {
      res.status(400).json({ success: false, error: "config is required" });
      return;
    }
    if (!VALID_TEST_TYPES.includes(config.testType)) {
      res.status(400).json({ success: false, error: `Invalid testType. Must be one of: ${VALID_TEST_TYPES.join(", ")}` });
      return;
    }
    if (!VALID_STRATEGIES.includes(config.strategy)) {
      res.status(400).json({ success: false, error: `Invalid strategy. Must be one of: ${VALID_STRATEGIES.join(", ")}` });
      return;
    }
    // count는 random 전략에서만 필수 (boundary/scenario는 고정 입력셋)
    if (config.strategy === "random") {
      if (!config.count || config.count < 1 || config.count > 1000) {
        res.status(400).json({ success: false, error: "count must be between 1 and 1000 for random strategy" });
        return;
      }
    }

    const result = await service.runTest(projectId, config, adapterId, testId, req.requestId);
    res.json({ success: true, data: result });
  }));

  // 결과 목록 (프로젝트별)
  router.get("/results", (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) {
      res.status(400).json({ success: false, error: "projectId query is required" });
      return;
    }
    const results = service.findByProjectId(projectId);
    res.json({ success: true, data: results });
  });

  // 결과 상세 조회
  router.get("/results/:testId", (req, res) => {
    const result = service.findById(req.params.testId);
    if (!result) {
      res.status(404).json({ success: false, error: "Test result not found" });
      return;
    }
    res.json({ success: true, data: result });
  });

  // 결과 삭제
  router.delete("/results/:testId", (req, res) => {
    const deleted = service.deleteById(req.params.testId);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Test result not found" });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
