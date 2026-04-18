import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BuildTargetSection } from "./BuildTargetSection";
import type { BuildTarget } from "@aegis/shared";

const mockTargets: BuildTarget[] = [
  {
    id: "t-1",
    projectId: "p-1",
    name: "gateway",
    relativePath: "gateway/",
    status: "ready",
    buildProfile: { sdkId: "generic-linux", compiler: "gcc", targetArch: "x86_64", languageStandard: "c17", headerLanguage: "auto" },
    includedPaths: ["gateway/"],
    createdAt: "2026-03-25T10:00:00Z",
    updatedAt: "2026-03-25T10:00:00Z",
  } as BuildTarget,
];

const mockUpdate = vi.fn();

vi.mock("../../../hooks/useBuildTargets", () => ({
  useBuildTargets: () => ({
    targets: mockTargets,
    loading: false,
    discovering: false,
    add: vi.fn(),
    remove: vi.fn(),
    update: mockUpdate,
    discover: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock("../../../hooks/usePipelineProgress", () => ({
  usePipelineProgress: () => ({
    targets: new Map(),
    isRunning: false,
    readyCount: 0,
    failedCount: 0,
    totalCount: 0,
    pipelineId: null,
    startPipeline: vi.fn(),
    retryTarget: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("../../../contexts/ToastContext", () => ({
  useToast: () => ({
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("../../../api/client", () => ({
  logError: vi.fn(),
  fetchSourceFiles: vi.fn().mockResolvedValue([
    { relativePath: "gateway/src/main.c", size: 1024, language: "C" },
    { relativePath: "gateway/include/utils.h", size: 256, language: "C" },
  ]),
}));

vi.mock("../../../api/sdk", () => ({
  fetchProjectSdks: vi.fn().mockResolvedValue({ builtIn: [], registered: [] }),
}));

describe("BuildTargetSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(mockTargets[0]);
  });

  it("renders target name and status", () => {
    render(<BuildTargetSection projectId="p-1" />);

    expect(screen.getByText("gateway")).toBeTruthy();
    expect(screen.getByText("분석 가능")).toBeTruthy();
  });

  it("opens add form on button click", () => {
    render(<BuildTargetSection projectId="p-1" />);

    fireEvent.click(screen.getByText("타겟 추가"));

    expect(screen.getByPlaceholderText("빌드 타겟 이름")).toBeTruthy();
  });

  it("has discover button", () => {
    render(<BuildTargetSection projectId="p-1" />);

    expect(screen.getByText("타겟 탐색")).toBeTruthy();
  });

  it("has pipeline run button", () => {
    render(<BuildTargetSection projectId="p-1" />);

    expect(screen.getByText(/빌드 & 분석 실행/)).toBeTruthy();
  });

  it("guards includedPaths edits and only saves supported fields", async () => {
    render(<BuildTargetSection projectId="p-1" />);

    fireEvent.click(screen.getByTitle("편집"));

    await waitFor(() => expect(screen.getAllByText("빌드 타겟 수정").length).toBeGreaterThanOrEqual(1));
    await waitFor(() => expect(screen.getByText(/2개 파일/)).toBeTruthy());
    expect(screen.getByRole("note").textContent).toContain("includedPaths는 수정 API에서 지원되지 않습니다");
    fireEvent.click(screen.getByText("저장"));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate).toHaveBeenCalledWith(
      "t-1",
      expect.objectContaining({
        name: "gateway",
        buildProfile: expect.objectContaining({ sdkId: "generic-linux" }),
      }),
    );
    expect(mockUpdate.mock.calls[0]?.[1]).not.toHaveProperty("includedPaths");
  });
});
