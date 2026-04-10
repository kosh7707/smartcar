import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUploadProgress } from "./useUploadProgress";

// ── MockWebSocket ──
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onmessage: ((evt: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  closeCalled = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  close() {
    this.closeCalled = true;
    this.onclose?.();
  }
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

vi.mock("../api/client", () => ({
  getWsBaseUrl: vi.fn(() => "ws://localhost:3000"),
  logError: vi.fn(),
}));

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUploadProgress", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() => useUploadProgress());
    expect(result.current.phase).toBe("idle");
    expect(result.current.isActive).toBe(false);
    expect(result.current.fileCount).toBeNull();
  });

  it("setUploading transitions to uploading phase", () => {
    const { result } = renderHook(() => useUploadProgress());

    act(() => {
      result.current.setUploading();
    });

    expect(result.current.phase).toBe("uploading");
    expect(result.current.isActive).toBe(true);
  });

  it("startTracking connects WS and sets received phase", () => {
    const { result } = renderHook(() => useUploadProgress());

    act(() => {
      result.current.startTracking("u-1");
    });

    expect(result.current.phase).toBe("received");
    expect(result.current.isActive).toBe(true);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain("uploadId=u-1");
  });

  it("processes upload-progress messages", () => {
    const { result } = renderHook(() => useUploadProgress());

    act(() => {
      result.current.startTracking("u-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "upload-progress",
        payload: { phase: "extracting", message: "추출 중", fileCount: 150 },
      });
    });

    expect(result.current.phase).toBe("extracting");
    expect(result.current.fileCount).toBe(150);
  });

  it("processes upload-complete and closes WS", () => {
    const { result } = renderHook(() => useUploadProgress());

    act(() => {
      result.current.startTracking("u-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "upload-complete",
        payload: { fileCount: 200 },
      });
    });

    expect(result.current.phase).toBe("complete");
    expect(result.current.fileCount).toBe(200);
    expect(result.current.isActive).toBe(false);
    expect(ws.closeCalled).toBe(true);
  });

  it("processes upload-error", () => {
    const { result } = renderHook(() => useUploadProgress());

    act(() => {
      result.current.startTracking("u-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "upload-error",
        payload: { error: "파일 형식 오류" },
      });
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toBe("파일 형식 오류");
    expect(result.current.isActive).toBe(false);
  });

  it("handles unexpected WS close during active phase by reconnecting", () => {
    const { result } = renderHook(() => useUploadProgress());

    act(() => {
      result.current.startTracking("u-1");
    });

    // Move to extracting phase
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "upload-progress",
        payload: { phase: "extracting" },
      });
    });

    // Simulate unexpected close — should trigger reconnection, not immediate failure
    act(() => {
      ws.onclose?.();
    });

    // With reconnecting WS, phase stays as-is (reconnection in progress)
    expect(result.current.phase).toBe("extracting");
    expect(result.current.connectionState).toBe("reconnecting");
  });
});
