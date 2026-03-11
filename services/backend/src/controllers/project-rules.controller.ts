import { Router } from "express";
import { RuleService } from "../services/rule.service";

export function createProjectRulesRouter(ruleService: RuleService): Router {
  const router = Router({ mergeParams: true });

  // 프로젝트 룰 목록
  router.get("/", (req, res) => {
    const pid = (req.params as any).pid as string;
    res.json({ success: true, data: ruleService.findByProjectId(pid) });
  });

  // 룰 생성
  router.post("/", (req, res) => {
    const pid = (req.params as any).pid as string;
    const { name, severity, description, suggestion, pattern, fixCode } = req.body;
    if (!name || !pattern) {
      res.status(400).json({ success: false, error: "name and pattern are required" });
      return;
    }

    try {
      const rule = ruleService.create(pid, {
        name, severity: severity ?? "medium",
        description: description ?? "", suggestion, pattern, fixCode,
      });
      res.status(201).json({ success: true, data: rule });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid pattern";
      res.status(400).json({ success: false, error: msg });
    }
  });

  // 룰 수정
  router.put("/:id", (req, res) => {
    const pid = (req.params as any).pid as string;
    const { id } = req.params;
    const existing = ruleService.findById(id);
    if (!existing || existing.projectId !== pid) {
      res.status(404).json({ success: false, error: "Rule not found" });
      return;
    }

    try {
      const updated = ruleService.update(id, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: "Rule not found" });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid pattern";
      res.status(400).json({ success: false, error: msg });
    }
  });

  // 룰 삭제
  router.delete("/:id", (req, res) => {
    const pid = (req.params as any).pid as string;
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
