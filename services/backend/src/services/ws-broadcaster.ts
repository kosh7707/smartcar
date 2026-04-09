/**
 * 제네릭 WebSocket 브로드캐스터
 *
 * 하나의 WS 경로 + 하나의 파라미터 키에 대해 연결 관리 + 브로드캐스트를 제공한다.
 * 기존 WsManager(monolith)를 모듈별로 분리하기 위한 구조.
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { WsChannel, WsEnvelopeMeta } from "@aegis/shared";
import { createLogger } from "../lib/logger";

const logger = createLogger("ws");

export class WsBroadcaster<T> {
  private clients = new Map<string, Set<WebSocket>>();
  private seqCounters = new Map<string, number>();
  readonly wss: WebSocketServer;

  constructor(
    /** WS 경로 (e.g. "/ws/dynamic-analysis") */
    readonly path: string,
    /** 쿼리 파라미터 키 (e.g. "sessionId") */
    private paramName: string,
    /** WS 채널 식별자 (envelope meta 용) */
    readonly channel?: WsChannel,
    /** 새 구독자에게 즉시 전달할 최신 스냅샷 (optional replay-on-subscribe) */
    private initialSnapshot?: (key: string) => T | T[] | undefined,
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
  }

  broadcast(key: string, message: T): void {
    const clients = this.clients.get(key);
    if (!clients) return;

    const payload = this.withMeta(key, message);
    const data = JSON.stringify(payload);
    for (const ws of [...clients]) {
      if (ws.readyState !== WebSocket.OPEN) {
        this.removeClient(key, ws);
        continue;
      }
      try {
        ws.send(data);
      } catch (err) {
        logger.warn({ err, [this.paramName]: key, path: this.path }, "WS send failed — removing client");
        this.removeClient(key, ws);
      }
    }
  }

  private handleConnection(ws: WebSocket, req: { url?: string }): void {
    const key = this.extractParam(req.url);
    if (!key) {
      logger.debug({ url: req.url, path: this.path, paramName: this.paramName }, "WS connection rejected — missing subscription key");
      ws.close(4000, `${this.paramName} required`);
      return;
    }

    if (!this.clients.has(key)) {
      this.clients.set(key, new Set());
    }
    this.clients.get(key)!.add(ws);
    logger.debug({ [this.paramName]: key, path: this.path }, "WS client connected");
    this.sendInitialSnapshot(key, ws);

    ws.on("close", () => {
      this.removeClient(key, ws);
      logger.debug({ [this.paramName]: key, path: this.path }, "WS client disconnected");
    });

    ws.on("error", (err) => {
      logger.warn({ err, [this.paramName]: key, path: this.path }, "WS client error — removing client");
      this.removeClient(key, ws);
    });
  }

  private removeClient(key: string, ws: WebSocket): void {
    this.clients.get(key)?.delete(ws);
    this.cleanupKeyIfEmpty(key);
  }

  private cleanupKeyIfEmpty(key: string): void {
    if ((this.clients.get(key)?.size ?? 0) > 0) {
      return;
    }
    this.clients.delete(key);
    this.seqCounters.delete(key);
  }

  private extractParam(url: string | undefined): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url, "http://localhost");
      return parsed.searchParams.get(this.paramName);
    } catch {
      return null;
    }
  }

  private sendInitialSnapshot(key: string, ws: WebSocket): void {
    if (!this.initialSnapshot || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const snapshot = this.initialSnapshot(key);
    if (!snapshot) {
      return;
    }

    const messages = Array.isArray(snapshot) ? snapshot : [snapshot];
    for (const message of messages) {
      try {
        const payload = this.withMeta(key, message);
        ws.send(JSON.stringify(payload));
      } catch (err) {
        logger.warn({ err, [this.paramName]: key, path: this.path }, "WS initial snapshot send failed");
        this.removeClient(key, ws);
        return;
      }
    }
  }

  private withMeta(key: string, message: T): unknown {
    if (!this.channel) {
      return message;
    }

    const seq = (this.seqCounters.get(key) ?? 0) + 1;
    this.seqCounters.set(key, seq);
    const meta: WsEnvelopeMeta = {
      channel: this.channel,
      projectId: key,
      timestamp: Date.now(),
      seq,
    };
    return { ...(message as object), meta };
  }
}

/** HTTP server에 여러 WsBroadcaster를 연결한다. upgrade 경로 라우팅만 담당. */
export function attachWsServers(server: Server, broadcasters: WsBroadcaster<unknown>[]): void {
  server.on("upgrade", (req, socket, head) => {
    let url: URL;
    try {
      url = new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`);
    } catch {
      logger.warn({ url: req.url, host: req.headers.host }, "WS upgrade rejected — malformed request URL");
      socket.destroy();
      return;
    }
    for (const bc of broadcasters) {
      if (url.pathname === bc.path) {
        bc.wss.handleUpgrade(req, socket, head, (ws) => {
          bc.wss.emit("connection", ws, req);
        });
        return;
      }
    }
    logger.debug({ path: url.pathname }, "WS upgrade rejected — unknown path");
    socket.destroy();
  });
}
