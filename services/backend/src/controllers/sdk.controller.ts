import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { Router, type Request, type Response, type NextFunction } from "express";
import type { SdkService, UploadedSdkFile } from "../services/sdk.service";
import type { IProjectDAO } from "../dao/interfaces";
import type { WsBroadcaster } from "../services/ws-broadcaster";
import type { WsSdkMessage } from "@aegis/shared";
import type { NotificationService } from "../services/notification.service";
import { asyncHandler } from "../middleware/async-handler";
import { NotFoundError, InvalidInputError } from "../lib/errors";
import { config } from "../config";

interface SdkUploadContext {
  projectId: string;
  sdkId: string;
  uploadRoot: string;
  totalBytes: number;
  uploadedBytes: number;
  lastPercent: number;
}

type SdkUploadRequest = Request & { sdkUploadContext?: SdkUploadContext };

function getUploadContext(req: Request): SdkUploadContext {
  const ctx = (req as SdkUploadRequest).sdkUploadContext;
  if (!ctx) throw new InvalidInputError("SDK upload context not initialized");
  return ctx;
}

function decodeFileName(name: string): string {
  return Buffer.from(name, "latin1").toString("utf-8");
}

function sanitizeFileName(name: string): string {
  const decoded = decodeFileName(name).replace(/\\/g, "/");
  const base = path.posix.basename(decoded);
  if (!base || base === "." || base === "..") {
    throw new InvalidInputError("Invalid SDK filename");
  }
  return base.replace(/[^\w.\-()+@]/g, "_");
}

class SdkUploadStorage implements multer.StorageEngine {
  constructor(private sdkWs?: WsBroadcaster<WsSdkMessage>, private uploadsDir: string = config.uploadsDir) {}

  _handleFile(req: Request, file: Express.Multer.File, cb: (error?: Error | null, info?: Partial<Express.Multer.File>) => void): void {
    const ctx = getUploadContext(req);
    const incomingDir = path.join(this.uploadsDir, ctx.projectId, "sdk", ctx.sdkId, "incoming");
    fs.mkdirSync(incomingDir, { recursive: true });

    let fileName: string;
    try {
      fileName = sanitizeFileName(file.originalname);
    } catch (err) {
      cb(err as Error);
      return;
    }

    const targetPath = path.join(incomingDir, `${crypto.randomUUID().slice(0, 8)}-${fileName}`);
    const out = fs.createWriteStream(targetPath);
    const totalBytes = ctx.totalBytes;
    let fileBytes = 0;
    let settled = false;

    const finish = (error?: Error | null): void => {
      if (settled) return;
      settled = true;

      if (error) {
        cb(error);
        return;
      }

      cb(null, {
        path: targetPath,
        destination: incomingDir,
        filename: fileName,
        originalname: decodeFileName(file.originalname),
        size: fileBytes,
      });
    };

    this.sdkWs?.broadcast(ctx.projectId, {
      type: "sdk-progress",
      payload: {
        sdkId: ctx.sdkId,
        phase: "uploading",
        message: "SDK 업로드 중...",
        percent: 0,
        uploadedBytes: 0,
        totalBytes: totalBytes > 0 ? totalBytes : undefined,
        fileName,
      },
    });

    file.stream.on("data", (chunk: Buffer) => {
      fileBytes += chunk.length;
      ctx.uploadedBytes += chunk.length;
      if (totalBytes <= 0) return;
      const percent = Math.min(99, Math.floor((ctx.uploadedBytes / totalBytes) * 100));
      if (percent <= ctx.lastPercent) return;
      ctx.lastPercent = percent;
      this.sdkWs?.broadcast(ctx.projectId, {
        type: "sdk-progress",
        payload: {
          sdkId: ctx.sdkId,
          phase: "uploading",
          message: `SDK 업로드 중... ${percent}%`,
          percent,
          uploadedBytes: ctx.uploadedBytes,
          totalBytes,
          fileName,
        },
      });
    });

    file.stream.on("error", (err) => {
      out.destroy(err);
      finish(err);
    });
    out.on("error", (err) => finish(err));
    out.on("close", () => finish());

    file.stream.pipe(out);
  }

  _removeFile(_req: Request, file: Express.Multer.File & { path?: string }, cb: (error: Error | null) => void): void {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlink(file.path, () => cb(null));
      return;
    }
    cb(null);
  }
}

function createSdkUploadMiddleware(sdkWs?: WsBroadcaster<WsSdkMessage>, uploadsDir?: string) {
  return multer({
    storage: new SdkUploadStorage(sdkWs, uploadsDir),
    limits: {
      files: 2000,
      fileSize: 4 * 1024 * 1024 * 1024,
    },
  }).array("file", 2000);
}

function ensureProjectAndUploadContext(projectDAO: IProjectDAO, uploadsDir: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const pid = req.params.pid as string;
    if (!projectDAO.findById(pid)) {
      next(new NotFoundError(`Project not found: ${pid}`));
      return;
    }

    const ctx: SdkUploadContext = {
      projectId: pid,
      sdkId: `sdk-${crypto.randomUUID().slice(0, 8)}`,
      uploadRoot: path.join(uploadsDir, pid, "sdk"),
      totalBytes: Number(req.headers["content-length"] ?? 0),
      uploadedBytes: 0,
      lastPercent: -1,
    };
    (req as SdkUploadRequest).sdkUploadContext = ctx;
    next();
  };
}

function cleanupUploadRoot(req: Request): void {
  const ctx = (req as SdkUploadRequest).sdkUploadContext;
  if (!ctx) return;
  const sdkRoot = path.join(ctx.uploadRoot, ctx.sdkId);
  fs.rmSync(sdkRoot, { recursive: true, force: true });
}

export function emitUploadFailure(
  req: Request,
  sdkWs: WsBroadcaster<WsSdkMessage> | undefined,
  notificationService: NotificationService | undefined,
  message: string,
): void {
  const ctx = (req as SdkUploadRequest).sdkUploadContext;
  if (!ctx) return;

  sdkWs?.broadcast(ctx.projectId, {
    type: "sdk-error",
    payload: {
      sdkId: ctx.sdkId,
      phase: "upload_failed",
      error: message,
    },
  });

  try {
    notificationService?.emit({
      projectId: ctx.projectId,
      type: "sdk_failed",
      title: "SDK 업로드 실패",
      body: message,
      jobKind: "sdk",
      resourceId: ctx.sdkId,
      correlationId: ctx.sdkId,
    });
  } catch {
    // notification failure must not affect upload failure propagation
  }
}

export function createSdkRouter(
  sdkService: SdkService,
  projectDAO: IProjectDAO,
  sdkWs?: WsBroadcaster<WsSdkMessage>,
  notificationService?: NotificationService,
  uploadsDir: string = config.uploadsDir,
): Router {
  const router = Router({ mergeParams: true });
  const upload = createSdkUploadMiddleware(sdkWs, uploadsDir);

  router.get("/", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const result = sdkService.listAll(pid);
    res.json({ success: true, data: result });
  }));

  router.get("/:id", asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const sdk = sdkService.findById(id);
    if (!sdk) throw new NotFoundError(`SDK not found: ${id}`);
    res.json({ success: true, data: sdk });
  }));

  router.post(
    "/",
    ensureProjectAndUploadContext(projectDAO, uploadsDir),
    (req, res, next) => {
      upload(req, res, (err) => {
        if (!err) {
          next();
          return;
        }
        cleanupUploadRoot(req);
        const message = err instanceof Error ? err.message : "SDK upload failed";
        emitUploadFailure(req, sdkWs, notificationService, message);
        next(new InvalidInputError(message));
      });
    },
    asyncHandler(async (req, res) => {
      const ctx = getUploadContext(req);
      const relativePathsField = req.body.relativePath;
      const relativePaths = Array.isArray(relativePathsField)
        ? relativePathsField.map((value) => String(value))
        : typeof relativePathsField === "string"
          ? [relativePathsField]
          : [];
      const files = (req.files as Express.Multer.File[] | undefined)?.map<UploadedSdkFile>((file) => ({
        originalName: decodeFileName(file.originalname),
        storedPath: file.path,
        size: file.size,
        relativePath: relativePaths.length > 0
          ? relativePaths[(req.files as Express.Multer.File[]).indexOf(file)]
          : (decodeFileName(file.originalname).includes("/") || decodeFileName(file.originalname).includes("\\")
            ? decodeFileName(file.originalname)
            : undefined),
      })) ?? [];

      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      const description = typeof req.body.description === "string" ? req.body.description.trim() : undefined;

      if (!name) {
        cleanupUploadRoot(req);
        throw new InvalidInputError("name is required");
      }
      if (files.length === 0) {
        cleanupUploadRoot(req);
        throw new InvalidInputError("SDK upload requires at least one file");
      }

      try {
        const sdk = await sdkService.register(
          ctx.projectId,
          {
            sdkId: ctx.sdkId,
            name,
            description,
            files,
          },
          req.requestId,
        );

        res.status(202).json({ success: true, data: sdk });
      } catch (err) {
        cleanupUploadRoot(req);
        throw err;
      }
    }),
  );

  router.delete("/:id", asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    await sdkService.remove(id, req.requestId);
    res.json({ success: true });
  }));

  return router;
}
