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
  ) {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
  }

  broadcast(key: string, message: T): void {
    const clients = this.clients.get(key);
    if (!clients) return;

    // envelope meta 자동 첨부 (channel이 설정된 경우)
    let payload: unknown = message;
    if (this.channel) {
      const seq = (this.seqCounters.get(key) ?? 0) + 1;
      this.seqCounters.set(key, seq);
      const meta: WsEnvelopeMeta = {
        channel: this.channel,
        projectId: key,
        timestamp: Date.now(),
        seq,
      };
      payload = { ...(message as object), meta };
    }
    const data = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch (err) {
          logger.warn({ err, [this.paramName]: key, path: this.path }, "WS send failed — removing client");
          clients.delete(ws);
        }
      }
    }
  }

  private handleConnection(ws: WebSocket, req: { url?: string }): void {
    const key = this.extractParam(req.url);
    if (!key) {
      ws.close(4000, `${this.paramName} required`);
      return;
    }

    if (!this.clients.has(key)) {
      this.clients.set(key, new Set());
    }
    this.clients.get(key)!.add(ws);
    logger.debug({ [this.paramName]: key, path: this.path }, "WS client connected");

    ws.on("close", () => {
      this.clients.get(key)?.delete(ws);
      if (this.clients.get(key)?.size === 0) {
        this.clients.delete(key);
      }
      logger.debug({ [this.paramName]: key, path: this.path }, "WS client disconnected");
    });
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
}

/** HTTP server에 여러 WsBroadcaster를 연결한다. upgrade 경로 라우팅만 담당. */
export function attachWsServers(server: Server, broadcasters: WsBroadcaster<unknown>[]): void {
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    for (const bc of broadcasters) {
      if (url.pathname === bc.path) {
        bc.wss.handleUpgrade(req, socket, head, (ws) => {
          bc.wss.emit("connection", ws, req);
        });
        return;
      }
    }
    socket.destroy();
  });
}
