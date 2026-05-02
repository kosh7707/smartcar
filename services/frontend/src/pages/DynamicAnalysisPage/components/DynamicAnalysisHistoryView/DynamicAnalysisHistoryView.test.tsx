import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DynamicAnalysisHistoryView } from "./DynamicAnalysisHistoryView";

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    status: "monitoring",
    source: { adapterName: "CAN Adapter" },
    messageCount: 12,
    alertCount: 3,
    startedAt: "2026-04-20T01:00:00Z",
    endedAt: undefined,
    ...overrides,
  } as any;
}

describe("DynamicAnalysisHistoryView", () => {
  it("renders the empty state and first-session CTA", () => {
    render(
      <DynamicAnalysisHistoryView
        projectId="project-1"
        connectionState="connected"
        hasConnected
        creating={false}
        adapterWarning={false}
        setAdapterWarning={vi.fn()}
        historyLoading={false}
        sessions={[]}
        confirmStopId={null}
        setConfirmStopId={vi.fn()}
        onOpenConfig={vi.fn()}
        onOpenSession={vi.fn()}
        onConfirmStop={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /첫 세션 시작/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "첫 세션 시작" })).toBeInTheDocument();
  });

  it("renders session history rows and opens the selected session", () => {
    const handleOpenSession = vi.fn();

    render(
      <DynamicAnalysisHistoryView
        projectId="project-1"
        connectionState="connected"
        hasConnected
        creating={false}
        adapterWarning={false}
        setAdapterWarning={vi.fn()}
        historyLoading={false}
        sessions={[makeSession(), makeSession({ id: "session-2", status: "stopped", endedAt: "2026-04-20T01:30:00Z" })]}
        confirmStopId={null}
        setConfirmStopId={vi.fn()}
        onOpenConfig={vi.fn()}
        onOpenSession={handleOpenSession}
        onConfirmStop={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByText("CAN Adapter")[0]!);

    expect(handleOpenSession).toHaveBeenCalled();
    expect(screen.getByText("모니터링 중")).toBeInTheDocument();
    expect(screen.getByText("종료됨")).toBeInTheDocument();
  });
});

