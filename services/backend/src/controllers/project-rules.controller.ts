import { Router, type Request } from "express";
import { RuleService } from "../services/rule.service";
import { asyncHandler } from "../middleware/async-handler";

export function createProjectRulesRouter(ruleService: RuleService): Router {
  const router = Router({ mergeParams: true });

  // 프로젝트 룰 목록
  router.get("/", (req: Request<{ pid: string }>, res) => {
    const pid = req.params.pid;
    res.json({ success: true, data: ruleService.findByProjectId(pid) });
  });

  // 룰 생성
  router.post("/", asyncHandler(async (req: Request<{ pid: string }>, res) => {
    const pid = req.params.pid;
    const { name, severity, description, suggestion, pattern, fixCode } = req.body;
    if (!name || !pattern) {
      res.status(400).json({ success: false, error: "name and pattern are required" });
      return;
    }

    const rule = ruleService.create(pid, {
      name, severity: severity ?? "medium",
      description: description ?? "", suggestion, pattern, fixCode,
    });
    res.status(201).json({ success: true, data: rule });
  }));

  // 룰 수정
  router.put("/:id", asyncHandler(async (req: Request<{ pid: string; id: string }>, res) => {
    const pid = req.params.pid;
    const { id } = req.params;
    const existing = ruleService.findById(id);
    if (!existing || existing.projectId !== pid) {
      res.status(404).json({ success: false, error: "Rule not found" });
      return;
    }

    const updated = ruleService.update(id, req.body);
    if (!updated) {
      res.status(404).json({ success: false, error: "Rule not found" });
      return;
    }
    res.json({ success: true, data: updated });
  }));

  // 룰 삭제
  router.delete("/:id", (req: Request<{ pid: string; id: string }>, res) => {
    const pid = req.params.pid;
    const { id } = req.params;
    const existing = ruleService.findById(id);
    if (!existing || existing.projectId !== pid) {
      res.status(404).json({ success: false, error: "Rule not found" });
      return;
    }
    ruleService.delete(id);
    res.json({ success: true });
  });

  return router;
}
