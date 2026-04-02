import { Router } from "express";
import type { SdkService } from "../services/sdk.service";
import type { IProjectDAO } from "../dao/interfaces";
import { asyncHandler } from "../middleware/async-handler";
import { NotFoundError, InvalidInputError } from "../lib/errors";

export function createSdkRouter(
  sdkService: SdkService,
  projectDAO: IProjectDAO,
): Router {
  const router = Router({ mergeParams: true });

  // GET /api/projects/:pid/sdk — 프로젝트의 등록 SDK 목록
  router.get("/", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const result = sdkService.listAll(pid);
    res.json({ success: true, data: result });
  }));

  // GET /api/projects/:pid/sdk/:id — 등록 SDK 상세
  router.get("/:id", asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const sdk = sdkService.findById(id);
    if (!sdk) throw new NotFoundError(`SDK not found: ${id}`);
    res.json({ success: true, data: sdk });
  }));

  // POST /api/projects/:pid/sdk — SDK 등록
  router.post("/", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const { name, description, localPath } = req.body as {
      name?: string;
      description?: string;
      localPath?: string;
    };

    if (!name) throw new InvalidInputError("name is required");

    // multipart file은 미들웨어에서 처리 (multer 등)
    const file = req.file?.buffer;

    if (!localPath && !file) {
      throw new InvalidInputError("SDK file upload or localPath is required");
    }

    const sdk = await sdkService.register(
      pid,
      { name, description, localPath },
      file,
      req.requestId,
    );

    res.status(202).json({ success: true, data: sdk });
  }));

  // DELETE /api/projects/:pid/sdk/:id — SDK 삭제
  router.delete("/:id", asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    await sdkService.remove(id, req.requestId);
    res.json({ success: true });
  }));

  return router;
}
