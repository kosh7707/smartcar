import { WebSocket } from "ws";
import { vi } from "vitest";

export function createMockWs(
  overrides?: Partial<Pick<WebSocket, "readyState">>
): WebSocket {
  return {
    readyState: overrides?.readyState ?? WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket;
}

/** Parse the JSON string sent via mockWs.send() at the given call index. */
export function parseSent(mockWs: WebSocket, callIndex = 0): any {
  const sendFn = mockWs.send as ReturnType<typeof vi.fn>;
  return JSON.parse(sendFn.mock.calls[callIndex][0] as string);
}

/** Count how many times send() was called on this mock. */
export function sendCount(mockWs: WebSocket): number {
  return (mockWs.send as ReturnType<typeof vi.fn>).mock.calls.length;
}
