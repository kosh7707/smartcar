export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ADAPTER_UNAVAILABLE"
  | "LLM_UNAVAILABLE"
  | "LLM_HTTP_ERROR"
  | "LLM_PARSE_ERROR"
  | "LLM_TIMEOUT"
  | "DB_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly retryable: boolean = false,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, cause?: unknown) {
    super("NOT_FOUND", 404, message, false, cause);
    this.name = "NotFoundError";
  }
}

export class InvalidInputError extends AppError {
  constructor(message: string, cause?: unknown) {
    super("INVALID_INPUT", 400, message, false, cause);
    this.name = "InvalidInputError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, cause?: unknown) {
    super("CONFLICT", 409, message, false, cause);
    this.name = "ConflictError";
  }
}

export class AdapterUnavailableError extends AppError {
  constructor(message: string, cause?: unknown) {
    super("ADAPTER_UNAVAILABLE", 502, message, true, cause);
    this.name = "AdapterUnavailableError";
  }
}

export class LlmUnavailableError extends AppError {
  constructor(message: string, cause?: unknown) {
    super("LLM_UNAVAILABLE", 502, message, true, cause);
    this.name = "LlmUnavailableError";
  }
}

export class LlmHttpError extends AppError {
  constructor(message: string, cause?: unknown) {
    super("LLM_HTTP_ERROR", 502, message, false, cause);
    this.name = "LlmHttpError";
  }
}

export class LlmParseError extends AppError {
  constructor(message: string, cause?: unknown) {
    super("LLM_PARSE_ERROR", 502, message, true, cause);
    this.name = "LlmParseError";
  }
}

export class LlmTimeoutError extends AppError {
  constructor(message: string, cause?: unknown) {
    super("LLM_TIMEOUT", 504, message, true, cause);
    this.name = "LlmTimeoutError";
  }
}

export class DbError extends AppError {
  constructor(message: string, cause?: unknown) {
    super("DB_ERROR", 500, message, false, cause);
    this.name = "DbError";
  }
}
