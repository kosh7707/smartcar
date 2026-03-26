import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePipelineProgress } from "./usePipelineProgress";

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
  runPipeline: vi.fn(),
  runPipelineTarget: vi.fn(),
  getWsBaseUrl: vi.fn(() => "ws://localhost:3000"),
  logError: vi.fn(),
}));

import { runPipeline, runPipelineTarget } from "../api/client";

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.mocked(runPipeline).mockResolvedValue({ pipelineId: "pipe-1", status: "running" });
  vi.mocked(runPipelineTarget).mockResolvedValue({ pipelineId: "pipe-1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePipelineProgress", () => {
  it("starts in initial state", () => {
    const { result } = renderHook(() => usePipelineProgress());
    expect(result.current.isRunning).toBe(false);
    expect(result.current.targets.size).toBe(0);
    expect(result.current.pipelineId).toBeNull();
  });

  it("startPipeline calls API and connects WS", async () => {
    const { result } = renderHook(() => usePipelineProgress());

    await act(async () => {
      await result.current.startPipeline("p-1", ["t-1"]);
    });

    expect(runPipeline).toHaveBeenCalledWith("p-1", ["t-1"]);
    expect(result.current.isRunning).toBe(true);
    expect(result.current.pipelineId).toBe("pipe-1");
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("processes pipeline-target-status messages", async () => {
    const { result } = renderHook(() => usePipelineProgress());

    await act(async () => {
      await result.current.startPipeline("p-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "pipeline-target-status",
        payload: { targetId: "t-1", targetName: "gateway", status: "building", phase: "build", message: "빌드 중" },
      });
    });

    expect(result.current.targets.size).toBe(1);
    const target = result.current.targets.get("t-1");
    expect(target?.name).toBe("gateway");
    expect(target?.status).toBe("building");
  });

  it("processes pipeline-complete", async () => {
    const { result } = renderHook(() => usePipelineProgress());

    await act(async () => {
      await result.current.startPipeline("p-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "pipeline-complete",
        payload: { readyCount: 2, failedCount: 1, totalCount: 3 },
      });
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.readyCount).toBe(2);
    expect(result.current.failedCount).toBe(1);
    expect(result.current.totalCount).toBe(3);
    expect(ws.closeCalled).toBe(true);
  });

  it("processes pipeline-error for a target", async () => {
    const { result } = renderHook(() => usePipelineProgress());

    await act(async () => {
      await result.current.startPipeline("p-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "pipeline-error",
        payload: { targetId: "t-2", targetName: "shared-lib", phase: "build", error: "컴파일 실패" },
      });
    });

    const target = result.current.targets.get("t-2");
    expect(target?.status).toBe("build_failed");
    expect(target?.error).toBe("컴파일 실패");
  });

  it("retryTarget calls API and reconnects WS if disconnected", async () => {
    const { result } = renderHook(() => usePipelineProgress());

    // No WS connected
    await act(async () => {
      await result.current.retryTarget("p-1", "t-2");
    });

    expect(runPipelineTarget).toHaveBeenCalledWith("p-1", "t-2");
    expect(result.current.isRunning).toBe(true);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("reset clears state", async () => {
    const { result } = renderHook(() => usePipelineProgress());

    await act(async () => {
      await result.current.startPipeline("p-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      result.current.reset();
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.targets.size).toBe(0);
    expect(result.current.pipelineId).toBeNull();
    expect(ws.closeCalled).toBe(true);
  });
});
