import fs from "fs";
import path from "path";
import { createLogger } from "../lib/logger";
import type { WsBroadcaster } from "./ws-broadcaster";
import type { WsSdkMessage } from "@aegis/shared";

const logger = createLogger("sdk-install-log");

export type SdkLogSource = "aegis" | "installer";
export type SdkLogKind = "lifecycle" | "heartbeat" | "output" | "terminal";
export type SdkLogStream = "stdout" | "stderr";

export interface SdkLogContext {
  projectId: string;
  sdkId: string;
  logPath: string;
  sdkWs?: WsBroadcaster<WsSdkMessage>;
}

export interface SdkLogEntry {
  source: SdkLogSource;
  kind: SdkLogKind;
  message: string;
  stream?: SdkLogStream;
  mirrorToServiceLog?: boolean;
}

export function buildSdkInstallLogPath(uploadsDir: string, projectId: string, sdkId: string): string {
  return path.join(uploadsDir, projectId, "sdk", sdkId, "install.log");
}

export function appendSdkLogLine(ctx: SdkLogContext, entry: SdkLogEntry): string {
  const timestamp = new Date().toISOString();
  const streamPart = entry.stream ? ` [stream=${entry.stream}]` : "";
  const line = `${timestamp} [${entry.source}] [kind=${entry.kind}] [project=${ctx.projectId}] [sdk=${ctx.sdkId}]${streamPart} ${entry.message}`;
  fs.mkdirSync(path.dirname(ctx.logPath), { recursive: true });
  fs.appendFileSync(ctx.logPath, `${line}\n`);
  ctx.sdkWs?.broadcast(ctx.projectId, {
    type: "sdk-log",
    payload: {
      sdkId: ctx.sdkId,
      timestamp,
      source: entry.source,
      kind: entry.kind,
      stream: entry.stream,
      message: entry.message,
      logPath: ctx.logPath,
    },
  });

  if (entry.mirrorToServiceLog || (entry.source === "installer" && entry.kind === "output")) {
    const payload = {
      projectId: ctx.projectId,
      sdkId: ctx.sdkId,
      kind: entry.kind,
      stream: entry.stream,
      message: entry.message,
      logPath: ctx.logPath,
    };
    if (entry.source === "installer") {
      logger.info(payload, "SDK installer output");
    } else if (entry.kind === "terminal") {
      logger.info(payload, "SDK install terminal event");
    } else if (entry.kind === "heartbeat") {
      logger.info(payload, "SDK install heartbeat");
    } else {
      logger.info(payload, "SDK install lifecycle event");
    }
  }

  return line;
}

export function createSdkOutputCollector(ctx: SdkLogContext, stream: SdkLogStream): { push: (chunk: Buffer | string) => void; flush: () => void } {
  let buffer = "";

  const writeLine = (line: string): void => {
    const normalized = line.replace(/\r/g, "").trim();
    if (!normalized) return;
    appendSdkLogLine(ctx, {
      source: "installer",
      kind: "output",
      stream,
      message: normalized,
    });
  };

  return {
    push(chunk: Buffer | string): void {
      buffer += chunk.toString();
      while (true) {
        const newlineIndex = buffer.search(/\r?\n/);
        if (newlineIndex < 0) break;
        const consumed = buffer.slice(0, newlineIndex);
        const separatorLength = buffer[newlineIndex] === "\r" && buffer[newlineIndex + 1] === "\n" ? 2 : 1;
        buffer = buffer.slice(newlineIndex + separatorLength);
        writeLine(consumed);
      }
    },
    flush(): void {
      writeLine(buffer);
      buffer = "";
    },
  };
}
