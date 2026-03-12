import type { Request, Response, NextFunction } from "express";
import { createLogger } from "../lib/logger";

const logger = createLogger("http");

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const level = req.path === "/health" ? "debug" : "info";

  logger[level]({ requestId: req.requestId, method: req.method, path: req.path }, "Request started");

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    logger[level](
      { requestId: req.requestId, method: req.method, path: req.path, statusCode: res.statusCode, durationMs },
      "Request completed"
    );
  });

  next();
}
