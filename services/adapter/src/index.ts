import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { Relay } from "./relay";
import logger from "./logger";

const args = process.argv.slice(2);
function getArg(name: string, defaultVal: string): string {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : defaultVal;
}

const PORT = Number(getArg("port", "4000"));

const app = express();
app.use(express.json());

const relay = new Relay();

// Health endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    ecu: {
      connected: relay.ecuConnected,
      ...(relay.ecuMeta ? { name: relay.ecuMeta.name, canIds: relay.ecuMeta.canIds } : {}),
    },
    backends: relay.backendCount,
  });
});

const server = createServer(app);

// WebSocket servers (noServer mode)
const ecuWss = new WebSocketServer({ noServer: true });
const backendWss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "", `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === "/ws/ecu") {
    ecuWss.handleUpgrade(req, socket, head, (ws) => {
      ecuWss.emit("connection", ws, req);
    });
  } else if (pathname === "/ws/backend") {
    backendWss.handleUpgrade(req, socket, head, (ws) => {
      backendWss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

ecuWss.on("connection", (ws) => {
  relay.onEcuConnect(ws);

  ws.on("message", (raw) => {
    relay.onEcuMessage(raw.toString());
  });

  ws.on("close", () => {
    relay.onEcuDisconnect();
  });
});

backendWss.on("connection", (ws) => {
  relay.onBackendConnect(ws);

  ws.on("message", (raw) => {
    relay.onBackendMessage(ws, raw.toString());
  });

  ws.on("close", () => {
    relay.onBackendDisconnect(ws);
  });
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, "Adapter started");
  logger.info("WS endpoints: /ws/ecu, /ws/backend");
});
