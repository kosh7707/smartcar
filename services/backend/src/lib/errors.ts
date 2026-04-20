export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "ADAPTER_UNAVAILABLE"
  | "LLM_UNAVAILABLE"
  | "LLM_HTTP_ERROR"
  | "LLM_PARSE_ERROR"
  | "LLM_TIMEOUT"
  | "AGENT_UNAVAILABLE"
  | "AGENT_TIMEOUT"
  | "SAST_UNAVAILABLE"
  | "SAST_TIMEOUT"
  | "BUILD_AGENT_UNAVAILABLE"
  | "BUILD_AGENT_TIMEOUT"
  | "KB_UNAVAILABLE"
  | "KB_HTTP_ERROR"
  | "PIPELINE_STEP_FAILED"
  | "DB_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly retryable: boolean = false,
    public readonly cause?: unknown,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("NOT_FOUND", 404, message, false, cause, details);
    this.name = "NotFoundError";
  }
}

export class InvalidInputError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("INVALID_INPUT", 400, message, false, cause, details);
    this.name = "InvalidInputError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("CONFLICT", 409, message, false, cause, details);
    this.name = "ConflictError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("FORBIDDEN", 403, message, false, cause, details);
    this.name = "ForbiddenError";
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("RATE_LIMITED", 429, message, true, cause, details);
    this.name = "RateLimitError";
  }
}

export class AdapterUnavailableError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("ADAPTER_UNAVAILABLE", 502, message, true, cause, details);
    this.name = "AdapterUnavailableError";
  }
}

export class LlmUnavailableError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("LLM_UNAVAILABLE", 502, message, true, cause, details);
    this.name = "LlmUnavailableError";
  }
}

export class LlmHttpError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("LLM_HTTP_ERROR", 502, message, false, cause, details);
    this.name = "LlmHttpError";
  }
}

export class LlmParseError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("LLM_PARSE_ERROR", 502, message, true, cause, details);
    this.name = "LlmParseError";
  }
}

export class LlmTimeoutError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("LLM_TIMEOUT", 504, message, true, cause, details);
    this.name = "LlmTimeoutError";
  }
}

export class AgentUnavailableError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("AGENT_UNAVAILABLE", 502, message, true, cause, details);
    this.name = "AgentUnavailableError";
  }
}

export class AgentTimeoutError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("AGENT_TIMEOUT", 504, message, true, cause, details);
    this.name = "AgentTimeoutError";
  }
}

export class SastUnavailableError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("SAST_UNAVAILABLE", 502, message, true, cause, details);
    this.name = "SastUnavailableError";
  }
}

export class SastTimeoutError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("SAST_TIMEOUT", 504, message, true, cause, details);
    this.name = "SastTimeoutError";
  }
}

export class BuildAgentUnavailableError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("BUILD_AGENT_UNAVAILABLE", 502, message, true, cause, details);
    this.name = "BuildAgentUnavailableError";
  }
}

export class BuildAgentTimeoutError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("BUILD_AGENT_TIMEOUT", 504, message, true, cause, details);
    this.name = "BuildAgentTimeoutError";
  }
}

export class KbUnavailableError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("KB_UNAVAILABLE", 502, message, true, cause, details);
    this.name = "KbUnavailableError";
  }
}

export class KbHttpError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("KB_HTTP_ERROR", 502, message, false, cause, details);
    this.name = "KbHttpError";
  }
}

export class PipelineStepError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("PIPELINE_STEP_FAILED", 502, message, true, cause, details);
    this.name = "PipelineStepError";
  }
}

export class DbError extends AppError {
  constructor(message: string, cause?: unknown, details?: Record<string, unknown>) {
    super("DB_ERROR", 500, message, false, cause, details);
    this.name = "DbError";
  }
}
