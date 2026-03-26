import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { Relay } from "../../relay";

/**
 * Integration tests — boots a real HTTP+WS server and connects real WebSocket clients.
 * Validates the full end-to-end protocol flow as documented in adapter-api.md.
 */

vi.mock("../../logger", () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------- Buffered WS client (eliminates message race conditions) ----------

class TestWsClient {
  readonly ws: WebSocket;
  private buffer: any[] = [];
  private resolvers: Array<(msg: any) => void> = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (this.resolvers.length > 0) {
        this.resolvers.shift()!(msg);
      } else {
        this.buffer.push(msg);
      }
    });
  }

  static connect(port: number, path: string): Promise<TestWsClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}${path}`);
      const client = new TestWsClient(ws);
      ws.on("open", () => resolve(client));
      ws.on("error", reject);
    });
  }

  /** Returns the next message (buffered or waits). */
  next(timeoutMs = 3000): Promise<any> {
    if (this.buffer.length > 0) {
      return Promise.resolve(this.buffer.shift()!);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`No message within ${timeoutMs}ms`)),
        timeoutMs
      );
      this.resolvers.push((msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
  }

  send(data: any): void {
    this.ws.send(JSON.stringify(data));
  }

  /** Collect messages that arrive within a window (doesn't fail if fewer arrive). */
  async collectFor(ms: number): Promise<any[]> {
    await new Promise((r) => setTimeout(r, ms));
    const msgs = [...this.buffer];
    this.buffer = [];
    return msgs;
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.CLOSED) return resolve();
      this.ws.on("close", () => resolve());
      this.ws.close();
    });
  }
}

// ---------- Server setup ----------

let server: Server;
let relay: Relay;
let port: number;
let ecuWss: WebSocketServer;
let backendWss: WebSocketServer;

beforeEach(async () => {
  relay = new Relay();
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

  server = createServer(app);
  ecuWss = new WebSocketServer({ noServer: true });
  backendWss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    if (url.pathname === "/ws/ecu") {
      ecuWss.handleUpgrade(req, socket, head, (ws) => ecuWss.emit("connection", ws, req));
    } else if (url.pathname === "/ws/backend") {
      backendWss.handleUpgrade(req, socket, head, (ws) =>
        backendWss.emit("connection", ws, req)
      );
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

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      port = (server.address() as any).port;
      resolve();
    });
  });
});

afterEach(async () => {
  for (const ws of ecuWss.clients) ws.terminate();
  for (const ws of backendWss.clients) ws.terminate();
  ecuWss.close();
  backendWss.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ---------- Tests ----------

const sampleFrame = {
  timestamp: "2026-01-01T00:00:00.000Z",
  id: "0x100",
  dlc: 8,
  data: "DE AD BE EF 01 02 03 04",
};

describe("Adapter Integration (real WebSocket)", () => {
  describe("Backend connection", () => {
    it("receives ecu-status:disconnected on connect when no ECU", async () => {
      const backend = await TestWsClient.connect(port, "/ws/backend");
      const msg = await backend.next();
      expect(msg.type).toBe("ecu-status");
      expect(msg.status).toBe("disconnected");
      await backend.close();
    });

    it("receives ecu-status:connected when ECU is already present", async () => {
      const ecu = await TestWsClient.connect(port, "/ws/ecu");
      await new Promise((r) => setTimeout(r, 50));

      const backend = await TestWsClient.connect(port, "/ws/backend");
      const msg = await backend.next();
      expect(msg.type).toBe("ecu-status");
      expect(msg.status).toBe("connected");
      await ecu.close();
      await backend.close();
    });

    it("receives cached ecu-info when ECU meta is available", async () => {
      const ecu = await TestWsClient.connect(port, "/ws/ecu");
      ecu.send({
        type: "ecu-info",
        ecu: { name: "TEST_ECU", canIds: ["0x100", "0x200"] },
      });
      await new Promise((r) => setTimeout(r, 50));

      const backend = await TestWsClient.connect(port, "/ws/backend");
      const msg1 = await backend.next(); // ecu-status
      const msg2 = await backend.next(); // ecu-info
      expect(msg1.type).toBe("ecu-status");
      expect(msg2.type).toBe("ecu-info");
      expect(msg2.ecu.name).toBe("TEST_ECU");
      expect(msg2.ecu.canIds).toEqual(["0x100", "0x200"]);
      await ecu.close();
      await backend.close();
    });
  });

  describe("ECU connection lifecycle", () => {
    it("backends receive ecu-status:connected when ECU connects", async () => {
      const backend = await TestWsClient.connect(port, "/ws/backend");
      await backend.next(); // initial disconnected

      const ecu = await TestWsClient.connect(port, "/ws/ecu");
      const msg = await backend.next();
      expect(msg.type).toBe("ecu-status");
      expect(msg.status).toBe("connected");
      await ecu.close();
      await backend.close();
    });

    it("backends receive ecu-status:disconnected when ECU disconnects", async () => {
      const ecu = await TestWsClient.connect(port, "/ws/ecu");
      await new Promise((r) => setTimeout(r, 50));

      const backend = await TestWsClient.connect(port, "/ws/backend");
      await backend.next(); // ecu-status:connected

      await ecu.close();
      const msg = await backend.next();
      expect(msg.type).toBe("ecu-status");
      expect(msg.status).toBe("disconnected");
      await backend.close();
    });
  });

  describe("CAN frame relay", () => {
    it("ECU can-frame is broadcast to all connected backends", async () => {
      const ecu = await TestWsClient.connect(port, "/ws/ecu");
      const b1 = await TestWsClient.connect(port, "/ws/backend");
      const b2 = await TestWsClient.connect(port, "/ws/backend");
      await b1.next(); // ecu-status
      await b2.next(); // ecu-status

      ecu.send({ type: "can-frame", frame: sampleFrame });
      const [msg1, msg2] = await Promise.all([b1.next(), b2.next()]);

      expect(msg1.type).toBe("can-frame");
      expect(msg1.frame.id).toBe("0x100");
      expect(msg2.type).toBe("can-frame");
      expect(msg2.frame.data).toBe("DE AD BE EF 01 02 03 04");

      await ecu.close();
      await b1.close();
      await b2.close();
    });
  });

  describe("Inject request-response flow", () => {
    it("full cycle: backend → adapter → ECU → adapter → backend", async () => {
      const ecu = await TestWsClient.connect(port, "/ws/ecu");
      const backend = await TestWsClient.connect(port, "/ws/backend");
      await backend.next(); // ecu-status

      backend.send({
        type: "inject-request",
        requestId: "req-e2e",
        frame: sampleFrame,
      });

      // ECU receives the inject-request
      const ecuMsg = await ecu.next();
      expect(ecuMsg.type).toBe("inject-request");
      expect(ecuMsg.requestId).toBe("req-e2e");

      // ECU responds
      ecu.send({
        type: "inject-response",
        requestId: "req-e2e",
        response: { success: true, data: "AA BB CC DD EE FF 00 11" },
      });

      // Backend receives the response
      const resp = await backend.next();
      expect(resp.type).toBe("inject-response");
      expect(resp.requestId).toBe("req-e2e");
      expect(resp.response.success).toBe(true);
      expect(resp.response.data).toBe("AA BB CC DD EE FF 00 11");

      await ecu.close();
      await backend.close();
    });

    it("only the requesting backend receives the inject-response (unicast)", async () => {
      const ecu = await TestWsClient.connect(port, "/ws/ecu");
      const b1 = await TestWsClient.connect(port, "/ws/backend");
      const b2 = await TestWsClient.connect(port, "/ws/backend");
      await b1.next(); // ecu-status
      await b2.next(); // ecu-status

      b1.send({
        type: "inject-request",
        requestId: "req-unicast",
        frame: sampleFrame,
      });

      const ecuMsg = await ecu.next();
      ecu.send({
        type: "inject-response",
        requestId: "req-unicast",
        response: { success: true },
      });

      const b1Resp = await b1.next();
      expect(b1Resp.type).toBe("inject-response");

      // b2 should NOT receive inject-response
      const b2Extra = await b2.collectFor(200);
      expect(b2Extra.find((m) => m.type === "inject-response")).toBeUndefined();

      await ecu.close();
      await b1.close();
      await b2.close();
    });
  });

  describe("Inject error cases", () => {
    it("returns no_response immediately when ECU is not connected", async () => {
      const backend = await TestWsClient.connect(port, "/ws/backend");
      await backend.next(); // ecu-status:disconnected

      backend.send({
        type: "inject-request",
        requestId: "req-noEcu",
        frame: sampleFrame,
      });

      const resp = await backend.next();
      expect(resp.type).toBe("inject-response");
      expect(resp.requestId).toBe("req-noEcu");
      expect(resp.response.success).toBe(false);
      expect(resp.response.error).toBe("no_response");
      await backend.close();
    });
  });

  describe("ECU disconnect during pending inject", () => {
    it("resolves pending requests with no_response", async () => {
      const ecu = await TestWsClient.connect(port, "/ws/ecu");
      const backend = await TestWsClient.connect(port, "/ws/backend");
      await backend.next(); // ecu-status:connected

      backend.send({
        type: "inject-request",
        requestId: "req-pending",
        frame: sampleFrame,
      });
      await ecu.next(); // ECU receives inject-request

      // ECU disconnects without responding
      await ecu.close();

      // Backend should receive ecu-status:disconnected and inject-response
      const msg1 = await backend.next();
      const msg2 = await backend.next();
      const msgs = [msg1, msg2];

      const injectResp = msgs.find((m) => m.type === "inject-response");
      expect(injectResp).toBeDefined();
      expect(injectResp.requestId).toBe("req-pending");
      expect(injectResp.response.error).toBe("no_response");

      const statusMsg = msgs.find((m) => m.type === "ecu-status");
      expect(statusMsg).toBeDefined();
      expect(statusMsg.status).toBe("disconnected");
      await backend.close();
    });
  });

  describe("Health endpoint", () => {
    it("returns status ok with ecu and backends info", async () => {
      const ecu = await TestWsClient.connect(port, "/ws/ecu");
      ecu.send({
        type: "ecu-info",
        ecu: { name: "ECU_SIM", canIds: ["0x100"] },
      });
      await new Promise((r) => setTimeout(r, 50));

      const backend = await TestWsClient.connect(port, "/ws/backend");
      await backend.next(); // ecu-status
      await new Promise((r) => setTimeout(r, 50));

      const res = await fetch(`http://localhost:${port}/health`);
      const body = (await res.json()) as any;

      expect(body.status).toBe("ok");
      expect(body.ecu.connected).toBe(true);
      expect(body.ecu.name).toBe("ECU_SIM");
      expect(body.ecu.canIds).toEqual(["0x100"]);
      expect(body.backends).toBe(1);

      await ecu.close();
      await backend.close();
    });
  });
});
