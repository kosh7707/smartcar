import { Router } from "express";
import type { TargetLibraryDAO } from "../dao/target-library.dao";
import type { IBuildTargetDAO, IProjectDAO } from "../dao/interfaces";
import { asyncHandler } from "../middleware/async-handler";
import { NotFoundError, InvalidInputError } from "../lib/errors";

export function createTargetLibraryRouter(
  targetLibraryDAO: TargetLibraryDAO,
  buildTargetDAO: IBuildTargetDAO,
  projectDAO: IProjectDAO,
): Router {
  const router = Router({ mergeParams: true });

  // GET /api/projects/:pid/targets/:tid/libraries
  router.get("/", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    const tid = req.params.tid as string;

    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);
    const target = buildTargetDAO.findById(tid);
    if (!target || target.projectId !== pid) throw new NotFoundError(`Build target not found: ${tid}`);

    const libraries = targetLibraryDAO.findByTargetId(tid);
    res.json({ success: true, data: libraries });
  }));

  // PATCH /api/projects/:pid/targets/:tid/libraries
  router.patch("/", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    const tid = req.params.tid as string;

    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);
    const target = buildTargetDAO.findById(tid);
    if (!target || target.projectId !== pid) throw new NotFoundError(`Build target not found: ${tid}`);

    const { libraries } = req.body as { libraries?: Array<{ id: string; included: boolean }> };
    if (!libraries || !Array.isArray(libraries)) {
      throw new InvalidInputError("libraries array required");
    }

    for (const lib of libraries) {
      if (typeof lib.id !== "string" || typeof lib.included !== "boolean") {
        throw new InvalidInputError("Each library must have id (string) and included (boolean)");
      }
      targetLibraryDAO.updateIncluded(lib.id, lib.included);
    }

    const updated = targetLibraryDAO.findByTargetId(tid);
    res.json({ success: true, data: updated });
  }));

  return router;
}
