import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Adapter, DynamicTestResult } from "@aegis/shared";
import { DynamicTestPage } from "./DynamicTestPage";

const mockGetDynamicTestResults = vi.fn();
const mockGetDynamicTestResult = vi.fn();
const mockDeleteDynamicTestResult = vi.fn();
const mockLogError = vi.fn();
const mockStartTest = vi.fn();
const mockReset = vi.fn();
const mockViewResult = vi.fn();
const mockToast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
const mockUseDynamicTest = vi.fn();
const mockUseAdapters = vi.fn();

vi.mock("../../api/client", () => ({
  getDynamicTestResults: (...args: unknown[]) => mockGetDynamicTestResults(...args),
  getDynamicTestResult: (...args: unknown[]) => mockGetDynamicTestResult(...args),
  deleteDynamicTestResult: (...args: unknown[]) => mockDeleteDynamicTestResult(...args),
  ApiError: class ApiError extends Error {
    retryable: boolean;

    constructor(message: string, retryable = false) {
      super(message);
      this.retryable = retryable;
    }
  },
  logError: (...args: unknown[]) => mockLogError(...args),
}));

vi.mock("../../hooks/useDynamicTest", () => ({
  useDynamicTest: (...args: unknown[]) => mockUseDynamicTest(...args),
}));

vi.mock("../../hooks/useAdapters", () => ({
  useAdapters: (...args: unknown[]) => mockUseAdapters(...args),
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => mockToast,
}));

function makeResult(index: number, overrides: Partial<DynamicTestResult> = {}): DynamicTestResult {
  return {
    id: `test-${index}`,
    projectId: "project-1",
    status: "completed",
    totalRuns: 50,
    crashes: 1,
    anomalies: 2,
    findings: [],
    createdAt: `2026-04-${String(index).padStart(2, "0")}T00:00:00Z`,
    config: {
      testType: "fuzzing",
      strategy: "random",
      targetEcu: `ECU-${index}`,
      protocol: "CAN",
      targetId: `0x10${index}`,
      count: 50,
    },
    ...overrides,
  };
}

function makeAdapter(overrides: Partial<Adapter> = {}): Adapter {
  return {
    id: "adapter-1",
    name: "Primary Adapter",
    url: "ws://adapter",
    connected: true,
    ecuConnected: true,
    ecuMeta: [{ name: "Brake ECU", canIds: ["0x321", "0x322"] }],
    projectId: "project-1",
    createdAt: "2026-04-10T00:00:00Z",
    ...overrides,
  };
}

function buildDynamicTestState(overrides: Record<string, unknown> = {}) {
  return {
    view: "config",
    progress: { current: 0, total: 0, crashes: 0, anomalies: 0, message: "" },
    findings: [],
    result: null,
    error: null,
    connectionState: "connected",
    startTest: mockStartTest,
    reset: mockReset,
    viewResult: mockViewResult,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/project-1/dynamic-test"]}>
      <Routes>
        <Route path="/projects/:projectId/dynamic-test" element={<DynamicTestPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DynamicTestPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDynamicTestResults.mockResolvedValue([]);
    mockGetDynamicTestResult.mockResolvedValue(makeResult(99));
    mockDeleteDynamicTestResult.mockResolvedValue(undefined);
    mockUseDynamicTest.mockReturnValue(buildDynamicTestState());
    mockUseAdapters.mockReturnValue({
      adapters: [],
      connected: [],
      hasConnected: false,
      loading: false,
      refresh: vi.fn(),
    });
  });

  it("shows history loading feedback while test history resolves", () => {
    mockGetDynamicTestResults.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText("이력 로딩 중...")).toBeInTheDocument();
    expect(document.title).toBe("AEGIS — Dynamic Test");
  });

  it("shows the empty state and warns when no adapter is connected", async () => {
    renderPage();

    expect(await screen.findByRole("button", { name: /첫 세션 시작/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "새 세션" }));

    expect(screen.getByText(/연결된 어댑터가 없습니다/)).toBeInTheDocument();
  });

  it("opens the config view and starts a test with adapter ECU defaults", async () => {
    mockUseAdapters.mockReturnValue({
      adapters: [makeAdapter()],
      connected: [makeAdapter()],
      hasConnected: true,
      loading: false,
      refresh: vi.fn(),
    });

    renderPage();

    await screen.findByRole("button", { name: /첫 세션 시작/ });
    fireEvent.click(screen.getByRole("button", { name: "새 세션" }));

    expect(await screen.findByText("새 세션")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /테스트 시작/i }));

    await waitFor(() =>
      expect(mockStartTest).toHaveBeenCalledWith(
        expect.objectContaining({
          testType: "fuzzing",
          strategy: "random",
          targetEcu: "Brake ECU",
          targetId: "0x321",
          protocol: "CAN",
          count: 50,
        }),
        "adapter-1",
      ),
    );
  });

  it("loads history items and fetches details when a result is opened", async () => {
    const history = [makeResult(1), makeResult(2, { config: { ...makeResult(2).config, strategy: "boundary" } })];
    mockGetDynamicTestResults.mockResolvedValue(history);
    mockGetDynamicTestResult.mockResolvedValue(makeResult(1, { findings: [{
      id: "finding-1",
      severity: "high",
      type: "crash",
      input: "AA",
      description: "Crash detected",
    }] }));

    renderPage();

    expect(await screen.findByText("ECU-1 · CAN · 0x101")).toBeInTheDocument();
    fireEvent.click(screen.getByText("ECU-1 · CAN · 0x101"));

    await waitFor(() => expect(mockGetDynamicTestResult).toHaveBeenCalledWith("test-1"));
    expect(mockViewResult).toHaveBeenCalledWith(expect.objectContaining({ id: "test-1" }));
  });

  it("deletes a history item after confirmation", async () => {
    mockGetDynamicTestResults.mockResolvedValue([makeResult(1)]);

    renderPage();

    expect(await screen.findByText("ECU-1 · CAN · 0x101")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("삭제"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(mockDeleteDynamicTestResult).toHaveBeenCalledWith("test-1"));
    await waitFor(() => expect(screen.queryByText("ECU-1 · CAN · 0x101")).not.toBeInTheDocument());
  });

  it("shows the empty history state and a toast when loading test history fails", async () => {
    mockGetDynamicTestResults.mockRejectedValue(new Error("load failed"));

    renderPage();

    expect(await screen.findByRole("button", { name: /첫 세션 시작/ })).toBeInTheDocument();
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
  });

  it("does not fetch test history and shows the empty state when no project id is present", async () => {
    render(
      <MemoryRouter initialEntries={["/dynamic-test"]}>
        <Routes>
          <Route path="/dynamic-test" element={<DynamicTestPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: /첫 세션 시작/ })).toBeInTheDocument();
    expect(mockGetDynamicTestResults).not.toHaveBeenCalled();
  });
});
