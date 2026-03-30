import WebSocket from "ws";
import crypto from "crypto";
import { createLogger, generateRequestId } from "../lib/logger";

// ── ECU 어댑터 인터페이스 ──

export interface EcuInput {
  canId: string;
  dlc: number;
  data: string; // hex string, e.g. "FF FF FF FF FF FF FF FF"
}

export interface EcuResponse {
  success: boolean;
  data?: string;
  error?: "no_response" | "malformed" | "reset" | "delayed";
  delayMs?: number;
}

export interface IEcuAdapter {
  sendAndReceive(input: EcuInput): Promise<EcuResponse>;
}

const logger = createLogger("adapter-client");

export interface CanFrame {
  timestamp: string;
  id: string;
  dlc: number;
  data: string;
}

type AdapterToBackendMessage =
  | { type: "can-frame"; frame: CanFrame }
  | { type: "inject-response"; requestId: string; response: EcuResponse }
  | { type: "ecu-status"; status: "connected" | "disconnected" }
  | { type: "ecu-info"; ecu: { name: string; canIds: string[] } };

type BackendToAdapterMessage =
  | { type: "inject-request"; requestId: string; frame: CanFrame };

interface PendingRequest {
  resolve: (response: EcuResponse) => void;
  timer: NodeJS.Timeout;
}

const INJECT_TIMEOUT_MS = 5000;
const RECONNECT_DELAY_MS = 3000;
const CONNECT_TIMEOUT_MS = 5000;

export class AdapterClient implements IEcuAdapter {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private canFrameHandler: ((frame: CanFrame) => void) | null = null;
  private ecuConnected = false;
  private _ecuMeta: { name: string; canIds: string[] } | null = null;
  private _connected = false;
  private _url: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = false;

  getUrl(): string | null {
    return this._url;
  }

  isConnected(): boolean {
    return this._connected;
  }

  isEcuConnected(): boolean {
    return this.ecuConnected;
  }

  getEcuMeta(): { name: string; canIds: string[] } | null {
    return this._ecuMeta;
  }

  async connectTo(url: string): Promise<void> {
    // 기존 연결이 있으면 먼저 끊기
    if (this._connected || this.ws) {
      this.disconnect();
    }

    this._url = url;
    this.shouldReconnect = true;
    return this.doConnect();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this._url = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    this.ecuConnected = false;
    this._ecuMeta = null;
  }

  private doConnect(): Promise<void> {
    if (!this._url) {
      return Promise.reject(new Error("No adapter URL configured"));
    }

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this._url!);
      let resolved = false;

      const connectTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.terminate();
          reject(new Error(`Connection timeout (${CONNECT_TIMEOUT_MS}ms)`));
        }
      }, CONNECT_TIMEOUT_MS);

      ws.on("open", () => {
        clearTimeout(connectTimeout);
        this.ws = ws;
        this._connected = true;
        logger.info({ url: this._url }, "Connected to Adapter");
        resolved = true;
        resolve();
      });

      ws.on("message", (raw) => {
        this.onMessage(raw.toString());
      });

      ws.on("close", () => {
        clearTimeout(connectTimeout);
        this._connected = false;
        this.ws = null;
        this.ecuConnected = false;
        logger.info("Disconnected from Adapter");

        // timeout all pending requests
        for (const [, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.resolve({ success: false, error: "no_response" });
        }
        this.pendingRequests.clear();

        // auto-reconnect (only if not user-initiated disconnect)
        if (this.shouldReconnect && this._url) {
          this.reconnectTimer = setTimeout(() => {
            const reconnRequestId = generateRequestId("reconn");
            logger.info({ requestId: reconnRequestId, url: this._url }, "Reconnecting to Adapter...");
            this.doConnect().catch((err) => logger.warn({ err, requestId: reconnRequestId, url: this._url }, "Adapter reconnect failed"));
          }, RECONNECT_DELAY_MS);
        }
      });

      ws.on("error", (err) => {
        clearTimeout(connectTimeout);
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
    });
  }

  // IEcuAdapter implementation (for dynamic test)
  async sendAndReceive(input: EcuInput): Promise<EcuResponse> {
    if (!this._connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { success: false, error: "no_response" };
    }

    const requestId = crypto.randomUUID();
    const frame: CanFrame = {
      timestamp: new Date().toISOString(),
      id: input.canId,
      dlc: input.dlc,
      data: input.data,
    };

    return new Promise<EcuResponse>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve({ success: false, error: "no_response" });
      }, INJECT_TIMEOUT_MS);

      this.pendingRequests.set(requestId, { resolve, timer });

      const msg: BackendToAdapterMessage = {
        type: "inject-request",
        requestId,
        frame,
      };
      this.ws!.send(JSON.stringify(msg));
    });
  }

  // For dynamic analysis monitoring
  setCanFrameHandler(handler: (frame: CanFrame) => void): void {
    this.canFrameHandler = handler;
  }

  private onMessage(raw: string): void {
    let msg: AdapterToBackendMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "can-frame") {
      this.canFrameHandler?.(msg.frame);
    } else if (msg.type === "inject-response") {
      const pending = this.pendingRequests.get(msg.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.requestId);
        pending.resolve(msg.response);
      }
    } else if (msg.type === "ecu-status") {
      this.ecuConnected = msg.status === "connected";
      if (msg.status === "disconnected") {
        this._ecuMeta = null;
      }
      logger.debug({ status: msg.status }, "ECU status changed");
    } else if (msg.type === "ecu-info") {
      this._ecuMeta = msg.ecu;
      logger.info({ ecuName: msg.ecu.name, canIds: msg.ecu.canIds }, "ECU info received");
    }
  }
}
