import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBuildTargets } from "./useBuildTargets";
import type { BuildTarget } from "@aegis/shared";

const mockTargets: BuildTarget[] = [
  {
    id: "t-1", projectId: "p-1", name: "gateway", relativePath: "gateway/",
    buildProfile: { sdkId: "nxp-s32g2", compiler: "gcc", targetArch: "aarch64", languageStandard: "c11", headerLanguage: "c" },
    buildSystem: "cmake", createdAt: "2026-01-01", updatedAt: "2026-01-01",
  },
];

vi.mock("@/common/api/client", () => ({
  fetchBuildTargets: vi.fn(),
  createBuildTarget: vi.fn(),
  updateBuildTarget: vi.fn(),
  deleteBuildTarget: vi.fn(),
  discoverBuildTargets: vi.fn(),
  logError: vi.fn(),
}));

import {
  fetchBuildTargets,
  createBuildTarget,
  updateBuildTarget,
  deleteBuildTarget,
  discoverBuildTargets,
} from "@/common/api/client";

const mockFetchBuildTargets = vi.mocked(fetchBuildTargets);
const mockCreateBuildTarget = vi.mocked(createBuildTarget);
const mockUpdateBuildTarget = vi.mocked(updateBuildTarget);
const mockDeleteBuildTarget = vi.mocked(deleteBuildTarget);
const mockDiscoverBuildTargets = vi.mocked(discoverBuildTargets);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchBuildTargets.mockResolvedValue(mockTargets);
});

describe("useBuildTargets", () => {
  it("loads targets on mount", async () => {
    const { result } = renderHook(() => useBuildTargets("p-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targets).toEqual(mockTargets);
    expect(mockFetchBuildTargets).toHaveBeenCalledWith("p-1");
  });

  it("does not load when no projectId", async () => {
    const { result } = renderHook(() => useBuildTargets(undefined));
    // Still loading true but no fetch
    expect(mockFetchBuildTargets).not.toHaveBeenCalled();
  });

  it("add appends to targets", async () => {
    const newTarget = { ...mockTargets[0], id: "t-2", name: "body" };
    mockCreateBuildTarget.mockResolvedValue(newTarget);

    const { result } = renderHook(() => useBuildTargets("p-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.add("body", "body/");
    });

    expect(result.current.targets).toHaveLength(2);
    expect(result.current.targets[1].name).toBe("body");
  });

  it("update replaces target in list", async () => {
    const updated = { ...mockTargets[0], name: "gw-renamed", includedPaths: ["src/", "include/"] };
    mockUpdateBuildTarget.mockResolvedValue(updated);

    const { result } = renderHook(() => useBuildTargets("p-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update("t-1", { name: "gw-renamed", includedPaths: ["src/", "include/"] });
    });

    expect(result.current.targets[0].name).toBe("gw-renamed");
    expect(mockUpdateBuildTarget).toHaveBeenCalledWith("p-1", "t-1", { name: "gw-renamed" });
  });

  it("remove filters target from list", async () => {
    mockDeleteBuildTarget.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBuildTargets("p-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.remove("t-1");
    });

    expect(result.current.targets).toHaveLength(0);
  });

  it("discover replaces all targets", async () => {
    const discovered = [
      { ...mockTargets[0], id: "t-10", name: "discovered-1" },
      { ...mockTargets[0], id: "t-11", name: "discovered-2" },
    ];
    mockDiscoverBuildTargets.mockResolvedValue(discovered);

    const { result } = renderHook(() => useBuildTargets("p-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.discover();
    });

    expect(result.current.targets).toHaveLength(2);
    expect(result.current.targets[0].name).toBe("discovered-1");
  });

  it("sets discovering flag during discover", async () => {
    let resolveDiscover: (value: BuildTarget[]) => void;
    mockDiscoverBuildTargets.mockImplementation(
      () => new Promise((r) => { resolveDiscover = r; }),
    );

    const { result } = renderHook(() => useBuildTargets("p-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.discover();
    });

    expect(result.current.discovering).toBe(true);

    await act(async () => {
      resolveDiscover!(mockTargets);
      await promise!;
    });

    expect(result.current.discovering).toBe(false);
  });
});
