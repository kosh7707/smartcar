import { createServer } from "http";
import express from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { WebSocket, WebSocketServer } from "ws";
import { Relay } from "./relay";

function hex(text: string): string {
  return Array.from(Buffer.from(text, "utf8"), (byte) =>
    byte.toString(16).padStart(2, "0").toUpperCase()
  ).join(" ");
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(__dirname, "../../..");
  const ecuSimulatorRoot = path.join(repoRoot, "services", "ecu-simulator");
  const bridgeCliPath = path.join(ecuSimulatorRoot, "src", "qemu-adapter-bridge-cli.ts");
  const tsxPath = path.join(ecuSimulatorRoot, "node_modules", ".bin", "tsx");
  const manifestPath = path.join(ecuSimulatorRoot, "qemu", "manifests", "sample-armhf-user.json");
  const smoke = readSmokeConfig(manifestPath);

  const relay = new Relay();
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      ecu: {
        connected: relay.ecuConnected,
        ...(relay.ecuMeta
          ? { name: relay.ecuMeta.name, canIds: relay.ecuMeta.canIds }
          : {}),
      },
      backends: relay.backendCount,
    });
  });

  const server = createServer(app);
  const ecuWss = new WebSocketServer({ noServer: true });
  const backendWss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    if (url.pathname === "/ws/ecu") {
      ecuWss.handleUpgrade(req, socket, head, (ws) => ecuWss.emit("connection", ws, req));
    } else if (url.pathname === "/ws/backend") {
      backendWss.handleUpgrade(req, socket, head, (ws) => backendWss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });

  ecuWss.on("connection", (ws) => {
    relay.onEcuConnect(ws);
    ws.on("message", (raw) => relay.onEcuMessage(raw.toString()));
    ws.on("close", () => relay.onEcuDisconnect());
  });

  backendWss.on("connection", (ws) => {
    relay.onBackendConnect(ws);
    ws.on("message", (raw) => relay.onBackendMessage(ws, raw.toString()));
    ws.on("close", () => relay.onBackendDisconnect(ws));
  });

  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind adapter smoke server");
  }

  const child = spawn(
    tsxPath,
    [
      bridgeCliPath,
      "--manifest=qemu/manifests/sample-armhf-user.json",
      `--adapter=ws://127.0.0.1:${address.port}/ws/ecu`,
      `--ecu-name=${smoke.ecuName}`,
    ],
    {
      cwd: ecuSimulatorRoot,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const backend = new WebSocket(`ws://127.0.0.1:${address.port}/ws/backend`);
  const messages = await collectMessages(backend, child, smoke);

  console.log(JSON.stringify({
    port: address.port,
    messageCount: messages.length,
    types: messages.map((msg) => msg.type),
    ecuInfo: messages.find((msg) => msg.type === "ecu-info"),
    firstResponse: messages.find((msg) => msg.type === "inject-response" && msg.requestId === smoke.cases[0].requestId),
    secondResponse: messages.find((msg) => msg.type === "inject-response" && msg.requestId === smoke.cases[1].requestId),
    stderr,
  }, null, 2));

  backend.close();
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  ecuWss.close();
  backendWss.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function readSmokeConfig(manifestPath: string): {
  ecuName: string;
  cases: Array<{ requestId: string; canId: string; text: string }>;
} {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    smoke?: {
      ecuName?: string;
      cases?: Array<{ requestId: string; canId: string; text: string }>;
    };
  };

  return {
    ecuName: manifest.smoke?.ecuName ?? "QEMU_SMOKE",
    cases: manifest.smoke?.cases ?? [
      { requestId: "req-1", canId: "0x123", text: "hello" },
      { requestId: "req-2", canId: "0x124", text: "exit" },
    ],
  };
}

async function collectMessages(
  backend: WebSocket,
  child: ReturnType<typeof spawn>,
  smoke: {
    cases: Array<{ requestId: string; canId: string; text: string }>;
  }
): Promise<any[]> {
  const messages: any[] = [];

  return await new Promise<any[]>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("adapter qemu smoke timeout")), 15000);

    backend.on("open", () => {
      // wait for server-side pushes
    });

    backend.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      messages.push(msg);

      if (msg.type === "ecu-info") {
        backend.send(JSON.stringify({
          type: "inject-request",
          requestId: smoke.cases[0].requestId,
          frame: {
            timestamp: new Date().toISOString(),
            id: smoke.cases[0].canId,
            dlc: Math.min(8, smoke.cases[0].text.length),
            data: hex(smoke.cases[0].text),
          },
        }));
        return;
      }

      if (msg.type === "inject-response" && msg.requestId === smoke.cases[0].requestId) {
        backend.send(JSON.stringify({
          type: "inject-request",
          requestId: smoke.cases[1].requestId,
          frame: {
            timestamp: new Date().toISOString(),
            id: smoke.cases[1].canId,
            dlc: Math.min(8, smoke.cases[1].text.length),
            data: hex(smoke.cases[1].text),
          },
        }));
        return;
      }

      if (msg.type === "inject-response" && msg.requestId === smoke.cases[1].requestId) {
        clearTimeout(timeout);
        resolve(messages);
      }
    });

    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`bridge exited with code ${code}`));
      }
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
