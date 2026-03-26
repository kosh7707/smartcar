import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BuildTargetSection } from "./BuildTargetSection";
import type { BuildTarget } from "@aegis/shared";

// Mock CSS
vi.mock("./BuildTargetSection.css", () => ({}));
vi.mock("../ui/TargetStatusBadge.css", () => ({}));
vi.mock("../ui/TargetProgressStepper.css", () => ({}));

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

vi.mock("../../hooks/useBuildTargets", () => ({
  useBuildTargets: () => ({
    targets: mockTargets,
    loading: false,
    discovering: false,
    add: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    discover: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock("../../hooks/usePipelineProgress", () => ({
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

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("../../api/client", () => ({
  logError: vi.fn(),
}));

describe("BuildTargetSection", () => {
  it("renders target name and status", () => {
    render(<BuildTargetSection projectId="p-1" />);

    expect(screen.getByText("gateway")).toBeTruthy();
    expect(screen.getByText("준비 완료")).toBeTruthy();
  });

  it("opens add form on button click", () => {
    render(<BuildTargetSection projectId="p-1" />);

    fireEvent.click(screen.getByText("타겟 추가"));

    expect(screen.getByPlaceholderText("gateway")).toBeTruthy();
  });

  it("has discover button", () => {
    render(<BuildTargetSection projectId="p-1" />);

    expect(screen.getByText("타겟 탐색")).toBeTruthy();
  });

  it("has pipeline run button", () => {
    render(<BuildTargetSection projectId="p-1" />);

    expect(screen.getByText(/빌드 & 분석 실행/)).toBeTruthy();
  });
});
