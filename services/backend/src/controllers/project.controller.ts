import { Router } from "express";
import { ProjectService } from "../services/project.service";

export function createProjectRouter(service: ProjectService): Router {
  const router = Router();

  // P1-8: 프로젝트 생성
  router.post("/", (req, res) => {
    const { name, description } = req.body as {
      name?: string;
      description?: string;
    };
    if (!name || name.trim().length === 0) {
      res.status(400).json({ success: false, error: "name is required" });
      return;
    }
    const project = service.create(name.trim(), description?.trim());
    res.status(201).json({ success: true, data: project });
  });

  // P1-8: 프로젝트 목록
  router.get("/", (_req, res) => {
    const projects = service.findAll();
    res.json({ success: true, data: projects });
  });

  // P1-8: 프로젝트 상세
  router.get("/:id", (req, res) => {
    const project = service.findById(req.params.id);
    if (!project) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }
    res.json({ success: true, data: project });
  });

  // P1-8: 프로젝트 수정
  router.put("/:id", (req, res) => {
    const { name, description } = req.body as {
      name?: string;
      description?: string;
    };
    const updated = service.update(req.params.id, { name, description });
    if (!updated) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }
    res.json({ success: true, data: updated });
  });

  // P1-8: 프로젝트 삭제
  router.delete("/:id", (req, res) => {
    const deleted = service.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }
    res.json({ success: true });
  });

  // P1-9: 프로젝트 Overview
  router.get("/:id/overview", (req, res) => {
    const overview = service.getOverview(req.params.id);
    if (!overview) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }
    res.json(overview);
  });

  return router;
}
