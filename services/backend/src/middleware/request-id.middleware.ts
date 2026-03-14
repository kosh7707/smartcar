import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers["x-request-id"];
  const requestId = (typeof incoming === "string" && incoming) ? incoming : `req-${crypto.randomUUID()}`;
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}
