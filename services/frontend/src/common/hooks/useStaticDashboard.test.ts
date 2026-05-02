import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useStaticDashboard } from "./useStaticDashboard";

vi.mock("@/common/api/client", () => ({
  fetchStaticDashboardSummary: vi.fn(),
  fetchProjectRuns: vi.fn(),
  fetchAllAnalysisStatuses: vi.fn(),
  fetchRunDetail: vi.fn(),
  logError: vi.fn(),
}));

import {
  fetchStaticDashboardSummary,
  fetchProjectRuns,
  fetchAllAnalysisStatuses,
  fetchRunDetail,
} from "@/common/api/client";

const mockSummary = { totalFindings: 10, resolvedFindings: 3 };
const mockRuns = [
  { id: "r-1", module: "static_analysis", status: "completed", createdAt: "2026-03-25T10:00:00Z" },
  { id: "r-2", module: "deep_analysis", status: "running", createdAt: "2026-03-25T09:00:00Z" },
];
const mockRunDetail = { run: { id: "r-1" }, findings: [], gateResult: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchStaticDashboardSummary).mockResolvedValue(mockSummary as never);
  vi.mocked(fetchProjectRuns).mockResolvedValue(mockRuns as never);
  vi.mocked(fetchAllAnalysisStatuses).mockResolvedValue([]);
  vi.mocked(fetchRunDetail).mockResolvedValue(mockRunDetail as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useStaticDashboard", () => {
  it("loads summary and runs on mount", async () => {
    const { result } = renderHook(() => useStaticDashboard("p-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchStaticDashboardSummary).toHaveBeenCalledWith("p-1", "30d");
    expect(fetchProjectRuns).toHaveBeenCalledWith("p-1");
    expect(result.current.summary).toEqual(mockSummary);
    expect(result.current.recentRuns).toHaveLength(2);
  });

  it("filters runs by module", async () => {
    vi.mocked(fetchProjectRuns).mockResolvedValue([
      ...mockRuns,
      { id: "r-3", module: "other_module", status: "completed", createdAt: "2026-03-25T08:00:00Z" },
    ] as never);

    const { result } = renderHook(() => useStaticDashboard("p-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Only static_analysis and deep_analysis modules
    expect(result.current.recentRuns).toHaveLength(2);
    expect(result.current.recentRuns.every((r) =>
      r.module === "static_analysis" || r.module === "deep_analysis",
    )).toBe(true);
  });

  it("fetches latest completed run detail", async () => {
    const { result } = renderHook(() => useStaticDashboard("p-1"));

    await waitFor(() => expect(result.current.latestRunLoading).toBe(false));

    expect(fetchRunDetail).toHaveBeenCalledWith("r-1");
    expect(result.current.latestRunDetail).toEqual(mockRunDetail);
  });

  it("detects active analysis", async () => {
    const runningStatus = {
      analysisId: "a-1",
      projectId: "p-1",
      status: "running",
      phase: "rule_engine",
    };
    vi.mocked(fetchAllAnalysisStatuses).mockResolvedValue([runningStatus] as never);

    const { result } = renderHook(() => useStaticDashboard("p-1"));

    await waitFor(() => expect(result.current.activeAnalysis).toBeTruthy());

    expect(result.current.activeAnalysis?.status).toBe("running");
  });

  it("does not load without projectId", async () => {
    renderHook(() => useStaticDashboard(undefined));

    // Wait a tick to ensure no async calls
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchStaticDashboardSummary).not.toHaveBeenCalled();
    expect(fetchProjectRuns).not.toHaveBeenCalled();
  });

  it("period change reloads data", async () => {
    const { result } = renderHook(() => useStaticDashboard("p-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setPeriod("7d");
    });

    await waitFor(() =>
      expect(fetchStaticDashboardSummary).toHaveBeenCalledWith("p-1", "7d"),
    );
  });
});
