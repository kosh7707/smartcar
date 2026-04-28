import { Router } from "express";
import type { ProjectOwnerSummary } from "@aegis/shared";
import { ProjectService } from "../services/project.service";
import { asyncHandler } from "../middleware/async-handler";

function deriveAvatar(name: string): string | null {
  const chars = Array.from(name.trim()).filter((char) => char.trim().length > 0);
  return chars.length > 0 ? chars.slice(0, 2).join("") : null;
}

function resolveProjectOwner(req: Express.Request): ProjectOwnerSummary | undefined {
  const user = req.user;
  if (!user) return undefined;
  const name = user.displayName || user.username;
  return {
    id: user.id || user.username,
    name,
    avatar: deriveAvatar(name),
    kind: "user",
  };
}

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
    const project = service.create(name.trim(), description?.trim(), resolveProjectOwner(req));
    res.status(201).json({ success: true, data: project });
  });

  // P1-8: 프로젝트 목록 (보안 요약 포함)
  router.get("/", (_req, res) => {
    const projects = service.findAllWithSummary();
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
    if (name !== undefined && name.trim().length === 0) {
      res.status(400).json({ success: false, error: "name is required" });
      return;
    }
    const updated = service.update(req.params.id, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description.trim() } : {}),
    });
    if (!updated) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }
    res.json({ success: true, data: updated });
  });

  // P1-8: 프로젝트 삭제
  router.delete("/:id", asyncHandler(async (req, res) => {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await service.delete(projectId);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }
    res.json({ success: true });
  }));

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
