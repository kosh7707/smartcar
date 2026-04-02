import { Router } from "express";
import type { BuildTargetService } from "../services/build-target.service";
import type { SastClient } from "../services/sast-client";
import type { ProjectSourceService } from "../services/project-source.service";
import type { IProjectDAO } from "../dao/interfaces";
import { asyncHandler } from "../middleware/async-handler";
import { NotFoundError, InvalidInputError } from "../lib/errors";

function validateProjectId(pid: string): void {
  if (!pid || !/^[\w-]+$/.test(pid)) {
    throw new InvalidInputError("Invalid project ID format");
  }
}

export function createBuildTargetRouter(
  buildTargetService: BuildTargetService,
  projectDAO: IProjectDAO,
  sourceService: ProjectSourceService,
  sastClient: SastClient | null,
): Router {
  const router = Router({ mergeParams: true });

  // GET /api/projects/:pid/targets — 타겟 목록
  router.get("/", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const targets = buildTargetService.findByProjectId(pid);
    res.json({ success: true, data: targets });
  }));

  // POST /api/projects/:pid/targets — 타겟 생성
  router.post("/", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const { name, relativePath, buildProfile, buildSystem, includedPaths } = req.body;
    if (!name || !relativePath) {
      throw new InvalidInputError("name and relativePath are required");
    }
    if (relativePath.includes("..")) {
      throw new InvalidInputError("relativePath must not contain '..'");
    }
    // includedPaths 검증
    if (Array.isArray(includedPaths)) {
      for (const p of includedPaths) {
        if (typeof p === "string" && p.includes("..")) {
          throw new InvalidInputError("includedPaths must not contain '..'");
        }
      }
    }

    const target = buildTargetService.create(pid, name, relativePath, buildProfile, buildSystem, includedPaths);
    res.status(201).json({ success: true, data: target });
  }));

  // PUT /api/projects/:pid/targets/:id — 타겟 수정
  router.put("/:id", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    const id = req.params.id as string;
    validateProjectId(pid);

    const existing = buildTargetService.findById(id);
    if (!existing) throw new NotFoundError(`Build target not found: ${id}`);
    if (existing.projectId !== pid) throw new NotFoundError(`Build target not found: ${id}`);

    const { name, relativePath, buildProfile, buildSystem } = req.body;
    const updated = buildTargetService.update(id, { name, relativePath, buildProfile, buildSystem });
    res.json({ success: true, data: updated });
  }));

  // DELETE /api/projects/:pid/targets/:id — 타겟 삭제
  router.delete("/:id", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    const id = req.params.id as string;
    validateProjectId(pid);

    const existing = buildTargetService.findById(id);
    if (!existing) throw new NotFoundError(`Build target not found: ${id}`);
    if (existing.projectId !== pid) throw new NotFoundError(`Build target not found: ${id}`);

    buildTargetService.delete(id);
    res.json({ success: true });
  }));

  // GET /api/projects/:pid/targets/:id/build-log — 빌드 로그 조회
  router.get("/:id/build-log", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    const id = req.params.id as string;
    validateProjectId(pid);

    const existing = buildTargetService.findById(id);
    if (!existing) throw new NotFoundError(`Build target not found: ${id}`);
    if (existing.projectId !== pid) throw new NotFoundError(`Build target not found: ${id}`);

    res.json({
      success: true,
      data: {
        buildLog: existing.buildLog ?? null,
        status: existing.status,
        updatedAt: existing.updatedAt,
      },
    });
  }));

  // POST /api/projects/:pid/targets/discover — 타겟 자동 탐색 (S4 호출)
  router.post("/discover", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const projectPath = sourceService.getProjectPath(pid);
    if (!projectPath) throw new InvalidInputError("No source code uploaded for this project");

    if (!sastClient) {
      throw new InvalidInputError("SAST Runner is not configured. Cannot discover build targets.");
    }

    const requestId = req.requestId;
    const result = await sastClient.discoverTargets(projectPath, requestId);

    const discovered = result.targets.map((t) => ({
      name: t.name,
      relativePath: t.relativePath,
      buildSystem: t.buildSystem,
    }));

    const created = buildTargetService.bulkCreateFromDiscovery(pid, discovered);
    res.json({
      success: true,
      data: { discovered: discovered.length, created: created.length, targets: created, elapsedMs: result.elapsedMs },
    });
  }));

  return router;
}
