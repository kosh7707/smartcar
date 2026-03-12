import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { WsMessage, WsStaticMessage, WsTestMessage } from "@smartcar/shared";
import { createLogger } from "../lib/logger";

const logger = createLogger("ws-manager");

export class WsManager {
  private clientWss: WebSocketServer | null = null;
  private staticWss: WebSocketServer | null = null;
  private testWss: WebSocketServer | null = null;

  // S1 클라이언트 (세션별)
  private clientsBySession = new Map<string, Set<WebSocket>>();

  // 정적 분석 클라이언트 (analysisId별)
  private staticClients = new Map<string, Set<WebSocket>>();

  // 동적 테스트 클라이언트 (testId별)
  private testClients = new Map<string, Set<WebSocket>>();

  attach(server: Server): void {
    // S1 Push WS: S2 → 프론트엔드
    this.clientWss = new WebSocketServer({ noServer: true });
    // 정적 분석 프로그레스 WS
    this.staticWss = new WebSocketServer({ noServer: true });
    // 동적 테스트 프로그레스 WS
    this.testWss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "", `http://${req.headers.host}`);
      const pathname = url.pathname;

      if (pathname === "/ws/dynamic-analysis") {
        this.clientWss!.handleUpgrade(req, socket, head, (ws) => {
          this.clientWss!.emit("connection", ws, req);
        });
      } else if (pathname === "/ws/static-analysis") {
        this.staticWss!.handleUpgrade(req, socket, head, (ws) => {
          this.staticWss!.emit("connection", ws, req);
        });
      } else if (pathname === "/ws/dynamic-test") {
        this.testWss!.handleUpgrade(req, socket, head, (ws) => {
          this.testWss!.emit("connection", ws, req);
        });
      } else {
        socket.destroy();
      }
    });

    // 정적 분석 클라이언트 연결 처리
    this.staticWss.on("connection", (ws, req) => {
      const analysisId = this.extractParam(req.url, "analysisId");
      if (!analysisId) {
        ws.close(4000, "analysisId required");
        return;
      }

      if (!this.staticClients.has(analysisId)) {
        this.staticClients.set(analysisId, new Set());
      }
      this.staticClients.get(analysisId)!.add(ws);
      logger.debug({ analysisId }, "Static analysis WS client connected");

      ws.on("close", () => {
        this.staticClients.get(analysisId)?.delete(ws);
        if (this.staticClients.get(analysisId)?.size === 0) {
          this.staticClients.delete(analysisId);
        }
        logger.debug({ analysisId }, "Static analysis WS client disconnected");
      });
    });

    // 동적 테스트 클라이언트 연결 처리
    this.testWss.on("connection", (ws, req) => {
      const testId = this.extractParam(req.url, "testId");
      if (!testId) {
        ws.close(4000, "testId required");
        return;
      }

      if (!this.testClients.has(testId)) {
        this.testClients.set(testId, new Set());
      }
      this.testClients.get(testId)!.add(ws);
      logger.debug({ testId }, "Dynamic test WS client connected");

      ws.on("close", () => {
        this.testClients.get(testId)?.delete(ws);
        if (this.testClients.get(testId)?.size === 0) {
          this.testClients.delete(testId);
        }
        logger.debug({ testId }, "Dynamic test WS client disconnected");
      });
    });

    // S1 클라이언트 연결 처리
    this.clientWss.on("connection", (ws, req) => {
      const sessionId = this.extractParam(req.url, "sessionId");
      if (!sessionId) {
        ws.close(4000, "sessionId required");
        return;
      }

      if (!this.clientsBySession.has(sessionId)) {
        this.clientsBySession.set(sessionId, new Set());
      }
      this.clientsBySession.get(sessionId)!.add(ws);
      logger.debug({ sessionId }, "S1 WS client connected");

      ws.on("close", () => {
        this.clientsBySession.get(sessionId)?.delete(ws);
        if (this.clientsBySession.get(sessionId)?.size === 0) {
          this.clientsBySession.delete(sessionId);
        }
        logger.debug({ sessionId }, "S1 WS client disconnected");
      });
    });
  }

  broadcast(sessionId: string, message: WsMessage): void {
    const clients = this.clientsBySession.get(sessionId);
    if (!clients) return;
    const data = JSON.stringify(message);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch (err) {
          logger.warn({ err, sessionId }, "WS send failed — removing client");
          clients.delete(ws);
        }
      }
    }
  }

  broadcastStatic(analysisId: string, message: WsStaticMessage): void {
    const clients = this.staticClients.get(analysisId);
    if (!clients) return;
    const data = JSON.stringify(message);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch (err) {
          logger.warn({ err, analysisId }, "WS send failed — removing client");
          clients.delete(ws);
        }
      }
    }
  }

  broadcastTest(testId: string, message: WsTestMessage): void {
    const clients = this.testClients.get(testId);
    if (!clients) return;
    const data = JSON.stringify(message);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch (err) {
          logger.warn({ err, testId }, "WS send failed — removing client");
          clients.delete(ws);
        }
      }
    }
  }

  private extractParam(url: string | undefined, param: string): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url, "http://localhost");
      return parsed.searchParams.get(param);
    } catch {
      return null;
    }
  }
}
