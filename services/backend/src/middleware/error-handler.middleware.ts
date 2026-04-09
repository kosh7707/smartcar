import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";
import { createLogger } from "../lib/logger";

const logger = createLogger("error-handler");

export function errorHandlerMiddleware(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId ?? "unknown";

  if (err instanceof AppError) {
    // AppError: 예상된 에러 — error 레벨은 5xx만
    if (err.statusCode >= 500) {
      logger.error({ err, requestId, code: err.code }, err.message);
    } else {
      logger.warn({ requestId, code: err.code }, err.message);
    }

    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      errorDetail: {
        code: err.code,
        message: err.message,
        requestId,
        retryable: err.retryable,
        ...(err.details ?? {}),
      },
    });
    return;
  }

  // 예상하지 못한 에러
  logger.error({ err, requestId }, "Unhandled error");

  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
    errorDetail: {
      code: "INTERNAL_ERROR",
      message: err.message || "Internal server error",
      requestId,
      retryable: false,
    },
  });
}
