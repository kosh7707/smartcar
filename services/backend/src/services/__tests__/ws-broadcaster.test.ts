import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { attachWsServers, WsBroadcaster } from "../ws-broadcaster";

type VoidHandler = (() => void) | undefined;
type ErrorHandler = ((err: Error) => void) | undefined;

function createFakeSocket(readyState: number = WebSocket.OPEN) {
  let closeHandler: VoidHandler;
  let errorHandler: ErrorHandler;
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn((event: string, handler: (() => void) | ((err: Error) => void)) => {
      if (event === "close") closeHandler = handler as () => void;
      if (event === "error") errorHandler = handler as (err: Error) => void;
    }),
    triggerClose: () => closeHandler?.(),
    triggerError: (err: Error) => errorHandler?.(err),
  };
}

describe("WsBroadcaster", () => {
  it("broadcasts flattened messages with meta and increments seq per subscription key", () => {
    const ws = createFakeSocket();
    const broadcaster = new WsBroadcaster<{ type: "upload-progress"; payload: { uploadId: string; phase: string; message: string } }>(
      "/ws/upload",
      "uploadId",
      "upload",
    );

    (broadcaster as any).handleConnection(ws as any, { url: "/ws/upload?uploadId=upload-1" });

    broadcaster.broadcast("upload-1", {
      type: "upload-progress",
      payload: { uploadId: "upload-1", phase: "received", message: "received" },
    });
    broadcaster.broadcast("upload-1", {
      type: "upload-progress",
      payload: { uploadId: "upload-1", phase: "extracting", message: "extracting" },
    });

    const [firstPayload, secondPayload] = ws.send.mock.calls.map(([raw]) => JSON.parse(raw as string));
    expect(firstPayload).toMatchObject({
      type: "upload-progress",
      payload: { uploadId: "upload-1", phase: "received", message: "received" },
      meta: { channel: "upload", projectId: "upload-1", seq: 1 },
    });
    expect(secondPayload).toMatchObject({
      type: "upload-progress",
      payload: { uploadId: "upload-1", phase: "extracting", message: "extracting" },
      meta: { channel: "upload", projectId: "upload-1", seq: 2 },
    });
    expect(typeof firstPayload.meta.timestamp).toBe("number");
    expect(typeof secondPayload.meta.timestamp).toBe("number");
  });

  it("cleans up stale clients and seq counters when the last client closes", () => {
    const ws = createFakeSocket();
    const broadcaster = new WsBroadcaster<{ type: "notification"; payload: { id: string } }>(
      "/ws/notifications",
      "projectId",
      "notification",
    );

    (broadcaster as any).handleConnection(ws as any, { url: "/ws/notifications?projectId=project-1" });
    broadcaster.broadcast("project-1", { type: "notification", payload: { id: "notif-1" } });

    ws.triggerClose();

    expect((broadcaster as any).clients.has("project-1")).toBe(false);
    expect((broadcaster as any).seqCounters.has("project-1")).toBe(false);
  });

  it("removes clients that emit socket errors", () => {
    const ws = createFakeSocket();
    const broadcaster = new WsBroadcaster<{ type: "notification"; payload: { id: string } }>(
      "/ws/notifications",
      "projectId",
      "notification",
    );

    (broadcaster as any).handleConnection(ws as any, { url: "/ws/notifications?projectId=project-1" });
    ws.triggerError(new Error("boom"));

    expect((broadcaster as any).clients.has("project-1")).toBe(false);
    expect((broadcaster as any).seqCounters.has("project-1")).toBe(false);
  });

  it("removes non-open clients during broadcast so stale sockets do not leak", () => {
    const stale = createFakeSocket(WebSocket.CLOSED);
    const broadcaster = new WsBroadcaster<{ type: "sdk-progress"; payload: { sdkId: string; phase: string; message: string } }>(
      "/ws/sdk",
      "projectId",
      "sdk",
    );

    (broadcaster as any).handleConnection(stale as any, { url: "/ws/sdk?projectId=project-1" });
    broadcaster.broadcast("project-1", {
      type: "sdk-progress",
      payload: { sdkId: "sdk-1", phase: "uploading", message: "start" },
    });

    expect(stale.send).not.toHaveBeenCalled();
    expect((broadcaster as any).clients.has("project-1")).toBe(false);
    expect((broadcaster as any).seqCounters.has("project-1")).toBe(false);
  });

  it("rejects connections that omit the required subscription query param", () => {
    const ws = createFakeSocket();
    const broadcaster = new WsBroadcaster<{ type: "notification"; payload: { id: string } }>(
      "/ws/notifications",
      "projectId",
      "notification",
    );

    (broadcaster as any).handleConnection(ws as any, { url: "/ws/notifications" });

    expect(ws.close).toHaveBeenCalledWith(4000, "projectId required");
    expect((broadcaster as any).clients.size).toBe(0);
  });

  it("destroys malformed upgrade requests instead of throwing", () => {
    const server = new EventEmitter();
    const socket = { destroy: vi.fn() };
    const broadcaster = new WsBroadcaster<{ type: "notification"; payload: { id: string } }>(
      "/ws/notifications",
      "projectId",
      "notification",
    );

    attachWsServers(server as any, [broadcaster]);
    expect(() => {
      server.emit("upgrade", { url: "/ws/notifications", headers: { host: "%zz" } }, socket, Buffer.alloc(0));
    }).not.toThrow();
    expect(socket.destroy).toHaveBeenCalledTimes(1);
  });

  it("rejects removed /ws/static-analysis upgrades as an unknown path", () => {
    const server = new EventEmitter();
    const socket = { destroy: vi.fn() };
    const broadcaster = new WsBroadcaster<{ type: "notification"; payload: { id: string } }>(
      "/ws/notifications",
      "projectId",
      "notification",
    );

    attachWsServers(server as any, [broadcaster]);
    server.emit("upgrade", { url: "/ws/static-analysis?analysisId=a-1", headers: { host: "localhost" } }, socket, Buffer.alloc(0));

    expect(socket.destroy).toHaveBeenCalledTimes(1);
  });
});
