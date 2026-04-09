import readline from "readline";
import { WebSocket } from "ws";
import type { AdapterToEcuMessage, EcuToAdapterMessage } from "./protocol";
import {
  createInjectResponse,
  createTelemetryFrame,
  getDefaultTelemetryCanId,
  hexPayloadToAscii,
} from "./qemu-bridge";
import {
  resolveManifestOrThrow,
  spawnHostFirmware,
} from "./qemu-runtime";
import logger from "./logger";

type PendingInject = {
  requestId: string;
  timer: NodeJS.Timeout;
};

const args = process.argv.slice(2);

function getArg(name: string, defaultVal: string): string {
  const found = args.find((arg) => arg.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : defaultVal;
}

async function main(): Promise<void> {
  const manifestPath = getArg("manifest", "qemu/manifests/sample-armhf-user.json");
  const adapterUrl = getArg("adapter", "ws://localhost:4000/ws/ecu");
  const ecuName = getArg("ecu-name", "QEMU_ECU");
  const telemetryCanId = getArg("telemetry-can-id", getDefaultTelemetryCanId());
  const injectTimeoutMs = Number(getArg("inject-timeout-ms", "2000"));

  const resolved = resolveManifestOrThrow(manifestPath);
  const firmware = spawnHostFirmware(resolved);
  const ws = new WebSocket(adapterUrl);
  const pendingInjects: PendingInject[] = [];

  const rl = readline.createInterface({ input: firmware.stdout });

  const flushPendingNoResponse = (): void => {
    while (pendingInjects.length > 0) {
      const pending = pendingInjects.shift()!;
      clearTimeout(pending.timer);
      send(ws, {
        type: "inject-response",
        requestId: pending.requestId,
        response: { success: false, error: "no_response" },
      });
    }
  };

  rl.on("line", (line) => {
    if (line.trim().length === 0) {
      return;
    }

    logger.info({ line }, "QEMU firmware stdout");
    send(ws, { type: "can-frame", frame: createTelemetryFrame(line, telemetryCanId) });

    const pending = pendingInjects.shift();
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    send(ws, {
      type: "inject-response",
      requestId: pending.requestId,
      response: createInjectResponse(line),
    });
  });

  ws.on("open", () => {
    logger.info({ adapterUrl, manifestPath }, "QEMU adapter bridge connected");
    send(ws, {
      type: "ecu-info",
      ecu: { name: ecuName, canIds: [telemetryCanId] },
    });
  });

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString()) as AdapterToEcuMessage;
    if (msg.type !== "inject-request") {
      return;
    }

    const text = hexPayloadToAscii(msg.frame.data) || "ping";
    logger.info({ requestId: msg.requestId, text }, "QEMU bridge inject-request");
    firmware.stdin.write(`${text}\n`);

    const timer = setTimeout(() => {
      const index = pendingInjects.findIndex((item) => item.requestId === msg.requestId);
      if (index >= 0) {
        pendingInjects.splice(index, 1);
      }
      send(ws, {
        type: "inject-response",
        requestId: msg.requestId,
        response: { success: false, error: "no_response" },
      });
    }, injectTimeoutMs);

    pendingInjects.push({ requestId: msg.requestId, timer });
  });

  ws.on("close", () => {
    logger.info("QEMU adapter bridge disconnected");
    flushPendingNoResponse();
    firmware.kill("SIGTERM");
  });

  ws.on("error", (err) => {
    logger.error({ err }, "QEMU adapter bridge connection error");
  });

  firmware.on("exit", (code, signal) => {
    logger.info({ code, signal }, "QEMU firmware exited");
    flushPendingNoResponse();
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
}

function send(ws: WebSocket, message: EcuToAdapterMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

main().catch((err) => {
  logger.error({ err }, "QEMU adapter bridge failed");
  process.exit(1);
});
