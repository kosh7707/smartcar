import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FilesBuildTargetPanel } from "./FilesBuildTargetPanel";

const targets = [
  {
    id: "target-1",
    name: "gateway",
    relativePath: "src/gateway/",
    status: "ready",
  },
  {
    id: "target-2",
    name: "body-control",
    relativePath: "src/body/",
    status: "discovered",
  },
] as any;

const sourceFiles = [
  { relativePath: "src/gateway/main.c", size: 100, language: "C" },
  { relativePath: "src/gateway/util.c", size: 50, language: "C" },
  { relativePath: "src/body/control.c", size: 200, language: "C" },
  { relativePath: "src/orphan.c", size: 80, language: "C" },
];

const targetMapping = {
  "src/gateway/main.c": { targetId: "target-1", targetName: "gateway" },
  "src/gateway/util.c": { targetId: "target-1", targetName: "gateway" },
  "src/body/control.c": { targetId: "target-2", targetName: "body-control" },
};

describe("FilesBuildTargetPanel", () => {
  it("renders empty state and create button when there are no targets", () => {
    const onOpenCreateTarget = vi.fn();
    render(
      <FilesBuildTargetPanel
        targets={[]}
        sourceFiles={[]}
        targetMapping={{}}
        activeTargetFilters={new Set()}
        onToggleFilter={vi.fn()}
        onClearFilters={vi.fn()}
        onOpenLog={vi.fn()}
        onOpenCreateTarget={onOpenCreateTarget}
      />,
    );

    expect(screen.getByText("빌드 타겟 매핑")).toBeInTheDocument();
    expect(screen.getByText("아직 생성된 빌드 타겟이 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /빌드 타겟 생성/ }));
    expect(onOpenCreateTarget).toHaveBeenCalledTimes(1);
  });

  it("renders filter chips, target rows, and triggers build log handler", () => {
    const onOpenLog = vi.fn();
    const onToggleFilter = vi.fn();
    const onClearFilters = vi.fn();
    render(
      <FilesBuildTargetPanel
        targets={targets}
        sourceFiles={sourceFiles}
        targetMapping={targetMapping}
        activeTargetFilters={new Set()}
        onToggleFilter={onToggleFilter}
        onClearFilters={onClearFilters}
        onOpenLog={onOpenLog}
        onOpenCreateTarget={vi.fn()}
      />,
    );

    expect(screen.getByText("빌드 타겟 매핑")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^gateway$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^body-control$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Untargeted" })).toBeInTheDocument();

    expect(screen.getAllByText("gateway").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("body-control").length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole("button", { name: /^gateway$/ }));
    expect(onToggleFilter).toHaveBeenCalledWith("target-1");

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "빌드 로그" }));
    expect(onOpenLog).toHaveBeenCalledWith({ id: "target-1", name: "gateway" });
    expect(screen.getAllByRole("button", { name: "빌드 로그" })).toHaveLength(1);
  });
});
