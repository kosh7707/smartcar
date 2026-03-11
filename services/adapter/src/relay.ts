import { WebSocket } from "ws";
import type {
  EcuToAdapterMessage,
  AdapterToEcuMessage,
  AdapterToBackendMessage,
  BackendToAdapterMessage,
} from "./protocol";

const INJECT_TIMEOUT_MS = 5000;

interface PendingRequest {
  timer: NodeJS.Timeout;
  backendWs: WebSocket;
}

export class Relay {
  private ecuWs: WebSocket | null = null;
  private backendClients = new Set<WebSocket>();
  private pendingRequests = new Map<string, PendingRequest>();
  private _ecuMeta: { name: string; canIds: string[] } | null = null;

  get ecuConnected(): boolean {
    return this.ecuWs !== null && this.ecuWs.readyState === WebSocket.OPEN;
  }

  get ecuMeta(): { name: string; canIds: string[] } | null {
    return this._ecuMeta;
  }

  get backendCount(): number {
    return this.backendClients.size;
  }

  onEcuConnect(ws: WebSocket): void {
    // replace existing ECU connection
    if (this.ecuWs && this.ecuWs.readyState === WebSocket.OPEN) {
      this.ecuWs.close(1000, "replaced");
    }
    this.ecuWs = ws;
    console.log("[Adapter] ECU connected");
    this.broadcastToBackends({ type: "ecu-status", status: "connected" });
  }

  onEcuDisconnect(): void {
    this.ecuWs = null;
    this._ecuMeta = null;
    console.log("[Adapter] ECU disconnected");
    this.broadcastToBackends({ type: "ecu-status", status: "disconnected" });

    // timeout all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      this.sendToBackend(pending.backendWs, {
        type: "inject-response",
        requestId,
        response: { success: false, error: "no_response" },
      });
    }
    this.pendingRequests.clear();
  }

  onBackendConnect(ws: WebSocket): void {
    this.backendClients.add(ws);
    console.log(`[Adapter] Backend connected (total: ${this.backendClients.size})`);
    // send current ECU status
    this.sendToBackend(ws, {
      type: "ecu-status",
      status: this.ecuConnected ? "connected" : "disconnected",
    });
    // send ECU meta if available
    if (this._ecuMeta) {
      this.sendToBackend(ws, { type: "ecu-info", ecu: this._ecuMeta });
    }
  }

  onBackendDisconnect(ws: WebSocket): void {
    this.backendClients.delete(ws);
    console.log(`[Adapter] Backend disconnected (total: ${this.backendClients.size})`);

    // clean up pending requests from this backend
    for (const [requestId, pending] of this.pendingRequests) {
      if (pending.backendWs === ws) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(requestId);
      }
    }
  }

  onEcuMessage(raw: string): void {
    let msg: EcuToAdapterMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "can-frame") {
      // relay CAN frames to all backends
      this.broadcastToBackends({ type: "can-frame", frame: msg.frame });
    } else if (msg.type === "ecu-info") {
      this._ecuMeta = msg.ecu;
      console.log(`[Adapter] ECU info: ${msg.ecu.name}, CAN IDs: ${msg.ecu.canIds.join(", ")}`);
      this.broadcastToBackends({ type: "ecu-info", ecu: msg.ecu });
    } else if (msg.type === "inject-response") {
      // route inject response to the requesting backend
      const pending = this.pendingRequests.get(msg.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.requestId);
        this.sendToBackend(pending.backendWs, {
          type: "inject-response",
          requestId: msg.requestId,
          response: msg.response,
        });
      }
    }
  }

  onBackendMessage(ws: WebSocket, raw: string): void {
    let msg: BackendToAdapterMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "inject-request") {
      if (!this.ecuConnected) {
        // no ECU connected -> immediate error
        this.sendToBackend(ws, {
          type: "inject-response",
          requestId: msg.requestId,
          response: { success: false, error: "no_response" },
        });
        return;
      }

      // forward to ECU
      const ecuMsg: AdapterToEcuMessage = {
        type: "inject-request",
        requestId: msg.requestId,
        frame: msg.frame,
      };
      this.ecuWs!.send(JSON.stringify(ecuMsg));

      // register timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(msg.requestId);
        this.sendToBackend(ws, {
          type: "inject-response",
          requestId: msg.requestId,
          response: { success: false, error: "no_response" },
        });
      }, INJECT_TIMEOUT_MS);

      this.pendingRequests.set(msg.requestId, { timer, backendWs: ws });
    }
  }

  private broadcastToBackends(msg: AdapterToBackendMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.backendClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  private sendToBackend(ws: WebSocket, msg: AdapterToBackendMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
