import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { BuildTarget } from "@aegis/shared";
import { BuildTargetRow } from "./BuildTargetRow";

vi.mock("./TargetLibraryPanel", () => ({
  TargetLibraryPanel: ({ targetName }: { targetName: string }) => <div>libraries:{targetName}</div>,
}));

const target: BuildTarget = {
  id: "target-1",
  projectId: "project-1",
  name: "gateway",
  relativePath: "src/gateway/",
  buildProfile: {
    sdkId: "sdk-1",
    compiler: "gcc",
    targetArch: "aarch64",
    languageStandard: "c11",
    headerLanguage: "c",
  },
  sdkChoiceState: "sdk-selected",
  status: "ready",
  buildSystem: "cmake",
  buildCommand: "cmake --build build",
  createdAt: "2026-04-10T00:00:00Z",
  updatedAt: "2026-04-10T00:00:00Z",
};

function renderRow(overrides: Partial<React.ComponentProps<typeof BuildTargetRow>> = {}) {
  return render(
    <BuildTargetRow
      projectId="project-1"
      target={target}
      status="ready"
      sdkName="SDK One"
      actionLocked={false}
      canDeepAnalyze
      onOpenLog={vi.fn()}
      onDeepAnalyze={vi.fn()}
      onRetry={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  );
}

describe("BuildTargetRow", () => {
  it("renders metadata, libraries, and primary actions for a ready target", () => {
    const onOpenLog = vi.fn();
    const onDeepAnalyze = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    renderRow({ onOpenLog, onDeepAnalyze, onEdit, onDelete });

    expect(screen.getByText("gateway")).toBeInTheDocument();
    expect(screen.getByText("src/gateway/")).toBeInTheDocument();
    expect(screen.getByText("SDK One")).toBeInTheDocument();
    expect(screen.getByText("cmake")).toBeInTheDocument();
    expect(screen.getByText("cmake --build build")).toBeInTheDocument();
    expect(screen.getByText("libraries:gateway")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("빌드 로그"));
    fireEvent.click(screen.getByTitle("심층 분석"));
    fireEvent.click(screen.getByTitle("편집"));
    fireEvent.click(screen.getByTitle("삭제"));

    expect(onOpenLog).toHaveBeenCalledWith({ id: "target-1", name: "gateway" });
    expect(onDeepAnalyze).toHaveBeenCalledWith("target-1");
    expect(onEdit).toHaveBeenCalledWith(target);
    expect(onDelete).toHaveBeenCalledWith(target);
  });

  it("shows retry on failed targets and respects action locking", () => {
    const onRetry = vi.fn();
    renderRow({
      status: "build_failed",
      error: "build failed",
      actionLocked: true,
      canDeepAnalyze: false,
      onRetry,
    });

    expect(screen.getByTitle("재실행")).toBeInTheDocument();
    expect(screen.getByTitle("편집")).toBeDisabled();
    expect(screen.getByTitle("삭제")).toBeDisabled();

    fireEvent.click(screen.getByTitle("재실행"));
    expect(onRetry).toHaveBeenCalledWith("target-1");
  });
});
