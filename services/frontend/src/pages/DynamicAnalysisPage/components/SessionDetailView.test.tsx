import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionDetailView } from "./SessionDetailView";

const mockFetchDynamicSessionDetail = vi.fn();
const mockToast = { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() };

vi.mock("../../../api/client", () => ({
  fetchDynamicSessionDetail: (...args: unknown[]) => mockFetchDynamicSessionDetail(...args),
  logError: vi.fn(),
}));

vi.mock("../../../contexts/ToastContext", () => ({
  useToast: () => mockToast,
}));

describe("SessionDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchDynamicSessionDetail.mockResolvedValue({
      session: {
        id: "session-1",
        status: "monitoring",
        source: { adapterName: "CAN Adapter" },
        startedAt: "2026-04-20T01:00:00Z",
        endedAt: undefined,
        messageCount: 2,
        alertCount: 1,
      },
      alerts: [
        {
          id: "alert-1",
          severity: "high",
          title: "Diagnostic anomaly",
          description: "비정상 응답 패턴 감지",
          detectedAt: "2026-04-20T01:01:00Z",
          llmAnalysis: "LLM 보조 분석",
        },
      ],
      recentMessages: [
        {
          id: "0x7DF",
          dlc: 8,
          data: "FF FF FF FF FF FF FF FF",
          timestamp: "2026-04-20T01:02:00Z",
          flagged: true,
        },
      ],
    });
  });

  it("loads and renders summary, alerts, and message history", async () => {
    render(<SessionDetailView sessionId="session-1" onBack={vi.fn()} />);

    await waitFor(() => expect(mockFetchDynamicSessionDetail).toHaveBeenCalledWith("session-1"));
    expect(await screen.findByText("세션 요약")).toBeInTheDocument();
    expect(screen.getByText("탐지 알림 (1)")).toBeInTheDocument();
    expect(screen.getByText("Diagnostic anomaly")).toBeInTheDocument();
    expect(screen.getByText("LLM 보조 분석")).toBeInTheDocument();
    expect(screen.getByText("CAN 메시지 (최근 1건)")).toBeInTheDocument();
    expect(screen.getAllByText("0x7DF").length).toBeGreaterThan(0);
  });
});
