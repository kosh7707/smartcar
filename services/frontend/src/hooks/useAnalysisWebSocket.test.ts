import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAnalysisWebSocket } from "./useAnalysisWebSocket";

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

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {
    ...actual,
    runAnalysis: vi.fn(),
    getWsBaseUrl: vi.fn(() => "ws://localhost:3000"),
    logError: vi.fn(),
  };
});
vi.mock("../api/analysis", () => ({
  fetchAnalysisStatus: vi.fn(),
}));

import { runAnalysis } from "../api/client";
import { fetchAnalysisStatus } from "../api/analysis";

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.mocked(runAnalysis).mockResolvedValue({
    analysisId: "a-1",
    buildTargetId: "t-1",
    executionId: "exec-1",
    status: "running",
  });
  vi.mocked(fetchAnalysisStatus).mockResolvedValue({
    analysisId: "a-1",
    projectId: "p-1",
    buildTargetId: "t-1",
    executionId: "exec-1",
    status: "running",
    phase: "quick_sast",
    currentChunk: 0,
    totalChunks: 1,
    message: "running",
    startedAt: "2026-04-14T00:00:00Z",
    updatedAt: "2026-04-14T00:00:00Z",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAnalysisWebSocket", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() => useAnalysisWebSocket());
    expect(result.current.stage).toBe("idle");
    expect(result.current.isRunning).toBe(false);
    expect(result.current.analysisId).toBeNull();
  });

  it("startAnalysis calls API and opens WebSocket", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket());

    await act(async () => {
      await result.current.startAnalysis("p-1", "t-1");
    });

    expect(runAnalysis).toHaveBeenCalledWith("p-1", "t-1");
    expect(result.current.analysisId).toBe("a-1");
    expect(result.current.buildTargetId).toBe("t-1");
    expect(result.current.executionId).toBe("exec-1");
    expect(result.current.stage).toBe("quick_sast");
    expect(result.current.isRunning).toBe(true);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain("analysisId=a-1");
  });

  it("processes analysis-progress messages", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket());

    await act(async () => {
      await result.current.startAnalysis("p-1", "t-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "analysis-progress",
        payload: {
          analysisId: "a-1",
          buildTargetId: "t-1",
          executionId: "exec-1",
          phase: "deep_analyzing",
          message: "분석 중",
          targetName: "gateway",
          targetProgress: { current: 1, total: 3 },
        },
      });
    });

    expect(result.current.stage).toBe("deep_analyzing");
    expect(result.current.targetName).toBe("gateway");
    expect(result.current.targetProgress).toEqual({ current: 1, total: 3 });
    expect(result.current.buildTargetId).toBe("t-1");
    expect(result.current.executionId).toBe("exec-1");
  });

  it("treats quick_graphing and deep_retrying as running phases", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket());

    await act(async () => {
      await result.current.startAnalysis("p-1", "t-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "analysis-progress",
        payload: {
          analysisId: "a-1",
          buildTargetId: "t-1",
          executionId: "exec-1",
          phase: "quick_graphing",
          message: "그래프 적재 중",
        },
      });
    });

    expect(result.current.stage).toBe("quick_graphing");
    expect(result.current.isRunning).toBe(true);

    act(() => {
      ws.simulateMessage({
        type: "analysis-progress",
        payload: {
          analysisId: "a-1",
          buildTargetId: "t-1",
          executionId: "exec-1",
          phase: "deep_retrying",
          message: "재시도 중",
        },
      });
    });

    expect(result.current.stage).toBe("deep_retrying");
    expect(result.current.isRunning).toBe(true);
  });

  it("processes analysis-quick-complete", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket());

    await act(async () => {
      await result.current.startAnalysis("p-1", "t-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "analysis-quick-complete",
        payload: { analysisId: "a-1", buildTargetId: "t-1", executionId: "exec-1", findingCount: 12 },
      });
    });

    expect(result.current.stage).toBe("quick_complete");
    expect(result.current.quickFindingCount).toBe(12);
  });

  it("processes analysis-deep-complete and closes WS", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket());

    await act(async () => {
      await result.current.startAnalysis("p-1", "t-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "analysis-deep-complete",
        payload: { analysisId: "a-1", buildTargetId: "t-1", executionId: "exec-1", findingCount: 5 },
      });
    });

    expect(result.current.stage).toBe("deep_complete");
    expect(result.current.deepFindingCount).toBe(5);
    expect(result.current.isRunning).toBe(false);
    expect(ws.closeCalled).toBe(true);
  });

  it("processes analysis-error", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket());

    await act(async () => {
      await result.current.startAnalysis("p-1", "t-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateMessage({
        type: "analysis-error",
        payload: { analysisId: "a-1", buildTargetId: "t-1", executionId: "exec-1", error: "SAST 실패", phase: "quick", retryable: true },
      });
    });

    expect(result.current.stage).toBe("error");
    expect(result.current.error).toBe("SAST 실패");
    expect(result.current.errorPhase).toBe("quick");
    expect(result.current.executionId).toBe("exec-1");
  });

  it("handles unexpected WS close during running stage by reconnecting", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket());

    await act(async () => {
      await result.current.startAnalysis("p-1", "t-1");
    });

    const ws = MockWebSocket.instances[0];
    // Simulate unexpected close — should trigger reconnection, not immediate error
    act(() => {
      ws.onclose?.();
    });

    // With reconnecting WS, stage stays as-is (reconnection in progress)
    expect(result.current.stage).toBe("quick_sast");
    expect(result.current.connectionState).toBe("reconnecting");
  });

  it("handles API failure on startAnalysis", async () => {
    vi.mocked(runAnalysis).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAnalysisWebSocket());

    await act(async () => {
      await result.current.startAnalysis("p-1", "t-1");
    });

    expect(result.current.stage).toBe("error");
    expect(result.current.error).toBe("Network error");
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("reset clears state and closes WS", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket());

    await act(async () => {
      await result.current.startAnalysis("p-1", "t-1");
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      result.current.reset();
    });

    expect(result.current.stage).toBe("idle");
    expect(result.current.analysisId).toBeNull();
    expect(result.current.buildTargetId).toBeNull();
    expect(ws.closeCalled).toBe(true);
  });

  it("resumeAnalysis restores lineage from status and opens WebSocket", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket());

    await act(async () => {
      await result.current.resumeAnalysis("a-1");
    });

    expect(fetchAnalysisStatus).toHaveBeenCalledWith("a-1");
    expect(result.current.analysisId).toBe("a-1");
    expect(result.current.buildTargetId).toBe("t-1");
    expect(result.current.executionId).toBe("exec-1");
    expect(result.current.stage).toBe("quick_sast");
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain("analysisId=a-1");
  });
});
