import { createLogger } from "./logger";
const logger = createLogger("utils");

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err, rawLength: raw.length }, "Failed to parse JSON, using fallback");
    return fallback;
  }
}
