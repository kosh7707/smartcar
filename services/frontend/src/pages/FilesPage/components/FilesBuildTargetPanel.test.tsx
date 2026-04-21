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

describe("FilesBuildTargetPanel", () => {
  it("renders empty state and create button when there are no targets", () => {
    const onOpenCreateTarget = vi.fn();
    render(
      <FilesBuildTargetPanel
        targets={[]}
        onOpenLog={vi.fn()}
        onOpenCreateTarget={onOpenCreateTarget}
      />,
    );

    expect(screen.getByText("빌드 타겟 현황")).toBeInTheDocument();
    expect(screen.getByText("아직 생성된 빌드 타겟이 없습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /빌드 타겟 생성/ }));
    expect(onOpenCreateTarget).toHaveBeenCalledTimes(1);
  });

  it("renders targets and opens build log for actionable rows", () => {
    const onOpenLog = vi.fn();
    render(
      <FilesBuildTargetPanel
        targets={targets}
        onOpenLog={onOpenLog}
        onOpenCreateTarget={vi.fn()}
      />,
    );

    expect(screen.getByText("빌드 타겟 현황")).toBeInTheDocument();
    expect(screen.getByText("gateway")).toBeInTheDocument();
    expect(screen.getByText("body-control")).toBeInTheDocument();
    expect(screen.getByText("src/gateway/")).toBeInTheDocument();
    expect(screen.getByText("src/body/")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "빌드 로그" }));
    expect(onOpenLog).toHaveBeenCalledWith({ id: "target-1", name: "gateway" });
    expect(screen.getAllByRole("button", { name: "빌드 로그" })).toHaveLength(1);
  });
});
