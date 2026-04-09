import fs from "fs";
import path from "path";
import { spawn, type ChildProcessByStdio } from "child_process";
import type { Readable } from "stream";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";
import type { EcuToAdapterMessage } from "../../protocol";
import { asciiToHexPayload } from "../../qemu-bridge";

const serviceRoot = path.resolve(__dirname, "../../..");
const tsxPath = path.join(serviceRoot, "node_modules", ".bin", "tsx");
const bridgeCliPath = path.join(serviceRoot, "src", "qemu-adapter-bridge-cli.ts");

describe("QEMU adapter bridge integration", () => {
  let child: ChildProcessByStdio<null, Readable, Readable> | null = null;
  let wss: WebSocketServer | null = null;

  afterEach(async () => {
    if (child && !child.killed) {
      child.kill("SIGTERM");
      await onceChildExit(child);
    }
    child = null;

    if (wss) {
      await new Promise<void>((resolve) => wss!.close(() => resolve()));
    }
    wss = null;

    cleanupCompiledArtifacts();
  });

  it("bridges QEMU firmware stdout and inject responses over the adapter WS contract", async () => {
    wss = new WebSocketServer({ port: 0, path: "/ws/ecu" });
    await onceEvent(wss, "listening");

    const address = wss.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind integration WebSocket server");
    }

    const received: EcuToAdapterMessage[] = [];
    const interactionDone = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("integration timeout")), 15000);

      wss!.on("connection", (ws: WebSocket) => {
        ws.on("message", (raw) => {
          const msg = JSON.parse(raw.toString()) as EcuToAdapterMessage;
          received.push(msg);

          if (msg.type === "ecu-info") {
            sendInject(ws, "req-1", "hello");
            return;
          }

          if (msg.type === "inject-response" && msg.requestId === "req-1") {
            sendInject(ws, "req-2", "exit");
            return;
          }

          if (msg.type === "inject-response" && msg.requestId === "req-2") {
            clearTimeout(timeout);
            setTimeout(() => {
              ws.close();
              resolve();
            }, 100);
          }
        });
      });
    });

    child = spawn(
      tsxPath,
      [
        bridgeCliPath,
        "--manifest=qemu/manifests/sample-armhf-user.json",
        `--adapter=ws://127.0.0.1:${address.port}/ws/ecu`,
        "--ecu-name=QEMU_TEST",
      ],
      {
        cwd: serviceRoot,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    await interactionDone;
    if (child) {
      child.kill("SIGTERM");
      await onceChildExit(child);
    }

    if (stderr.trim().length > 0) {
      throw new Error(`bridge stderr was not empty:\n${stderr}`);
    }

    const ecuInfo = received.find((msg) => msg.type === "ecu-info");
    const telemetryFrames = received.filter((msg) => msg.type === "can-frame");
    const firstResponse = received.find(
      (msg): msg is Extract<EcuToAdapterMessage, { type: "inject-response" }> =>
        msg.type === "inject-response" && msg.requestId === "req-1"
    );
    const secondResponse = received.find(
      (msg): msg is Extract<EcuToAdapterMessage, { type: "inject-response" }> =>
        msg.type === "inject-response" && msg.requestId === "req-2"
    );

    expect(ecuInfo).toEqual({
      type: "ecu-info",
      ecu: {
        name: "QEMU_TEST",
        canIds: ["0x700"],
      },
    });
    expect(telemetryFrames.length).toBeGreaterThanOrEqual(2);
    expect(firstResponse?.response.success).toBe(true);
    expect(secondResponse?.response.success).toBe(true);
  }, 20000);
});

function sendInject(ws: WebSocket, requestId: string, text: string): void {
  ws.send(
    JSON.stringify({
      type: "inject-request",
      requestId,
      frame: {
        timestamp: new Date().toISOString(),
        id: requestId === "req-1" ? "0x123" : "0x124",
        dlc: Math.min(8, text.length),
        data: asciiToHexPayload(text, 8),
      },
    })
  );
}

function cleanupCompiledArtifacts(): void {
  for (const fileName of ["sample-ecu-armhf", "sample-ecu-armhf.o"]) {
    const filePath = path.join(serviceRoot, "qemu", "out", fileName);
    if (pathExists(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore cleanup failure in test teardown
      }
    }
  }
}

function pathExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function onceEvent(emitter: NodeJS.EventEmitter, eventName: string): Promise<void> {
  return new Promise((resolve) => emitter.once(eventName, () => resolve()));
}

function onceChildExit(childProcess: ChildProcessByStdio<null, Readable, Readable>): Promise<void> {
  return new Promise((resolve) => {
    if (childProcess.exitCode !== null) {
      resolve();
      return;
    }
    childProcess.once("exit", () => resolve());
  });
}
