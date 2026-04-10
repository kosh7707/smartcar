import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { BuildTarget } from "@aegis/shared";
import { TargetSelectDialog } from "./TargetSelectDialog";

const targets: BuildTarget[] = [
  {
    id: "t-1", projectId: "p-1", name: "gateway", relativePath: "gateway/",
    buildProfile: { sdkId: "nxp-s32g2", compiler: "gcc", targetArch: "aarch64", languageStandard: "c11", headerLanguage: "c" },
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  },
  {
    id: "t-2", projectId: "p-1", name: "body-control", relativePath: "body-control/",
    buildProfile: { sdkId: "nxp-s32k", compiler: "arm-gcc", targetArch: "arm-cortex-m7", languageStandard: "c11", headerLanguage: "c" },
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  },
];

describe("TargetSelectDialog", () => {
  it("does not render when open=false", () => {
    render(<TargetSelectDialog open={false} targets={targets} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText("분석 대상 선택")).not.toBeInTheDocument();
  });

  it("renders all targets when open", () => {
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("분석 대상 선택")).toBeInTheDocument();
    expect(screen.getByText("gateway")).toBeInTheDocument();
    expect(screen.getByText("body-control")).toBeInTheDocument();
  });

  it("starts with all targets selected", () => {
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("분석 실행 (2개)")).toBeInTheDocument();
  });

  it("toggles individual target", () => {
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    // Click gateway to deselect
    fireEvent.click(screen.getByText("gateway").closest(".tsd__row")!);
    expect(screen.getByText("분석 실행 (1개)")).toBeInTheDocument();
  });

  it("toggle all deselects then reselects", () => {
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const selectAll = screen.getByText(/전체 선택/).closest(".tsd__select-all")!;

    // Deselect all
    fireEvent.click(selectAll);
    const btn = screen.getByText(/분석 실행/);
    expect(btn).toBeDisabled();

    // Reselect all
    fireEvent.click(selectAll);
    expect(screen.getByText("분석 실행 (2개)")).toBeInTheDocument();
  });

  it("confirm button disabled when nothing selected", () => {
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    // Deselect all
    fireEvent.click(screen.getByText(/전체 선택/).closest(".tsd__select-all")!);
    expect(screen.getByText(/분석 실행/).closest("button")).toBeDisabled();
  });

  it("calls onConfirm with selected IDs", () => {
    const onConfirm = vi.fn();
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={onConfirm} onCancel={vi.fn()} />);

    // Deselect body-control
    fireEvent.click(screen.getByText("body-control").closest(".tsd__row")!);

    // Confirm
    fireEvent.click(screen.getByText("분석 실행 (1개)"));
    expect(onConfirm).toHaveBeenCalledWith(["t-1"]);
  });

  it("calls onCancel on overlay click", () => {
    const onCancel = vi.fn();
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(document.querySelector(".confirm-overlay")!);
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on cancel button click", () => {
    const onCancel = vi.fn();
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("취소"));
    expect(onCancel).toHaveBeenCalled();
  });
});
