import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { BuildTarget } from "@aegis/shared";
import { TargetSelectDialog } from "../TargetSelectDialog/TargetSelectDialog";

const targets: BuildTarget[] = [
  {
    id: "t-1", projectId: "p-1", name: "gateway", relativePath: "gateway/",
    buildProfile: { sdkId: "nxp-s32g2", compiler: "gcc", targetArch: "aarch64", languageStandard: "c11", headerLanguage: "c" },
    sdkChoiceState: "sdk-selected",
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  },
  {
    id: "t-2", projectId: "p-1", name: "body-control", relativePath: "body-control/",
    buildProfile: { sdkId: "nxp-s32k", compiler: "arm-gcc", targetArch: "arm-cortex-m7", languageStandard: "c11", headerLanguage: "c" },
    sdkChoiceState: "sdk-selected",
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

  it("starts with the first target selected", () => {
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("분석 실행")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /gateway/ })).toHaveAttribute("aria-checked", "true");
  });

  it("switches selected target", () => {
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /body-control/ }));
    expect(screen.getByRole("radio", { name: /body-control/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /gateway/ })).toHaveAttribute("aria-checked", "false");
  });

  it("switches selected target from the keyboard", () => {
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const bodyControl = screen.getByRole("radio", { name: /body-control/ });

    fireEvent.keyDown(bodyControl, { key: " " });

    expect(bodyControl).toHaveAttribute("aria-checked", "true");
  });

  it("calls onConfirm with the selected ID", () => {
    const onConfirm = vi.fn();
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: /body-control/ }));
    fireEvent.click(screen.getByText("분석 실행"));
    expect(onConfirm).toHaveBeenCalledWith("t-2");
  });

  it("calls onCancel on overlay click", () => {
    const onCancel = vi.fn();
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(document.querySelector(".modal-overlay")!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not cancel when the dialog content is clicked", () => {
    const onCancel = vi.fn();
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("분석 대상 선택"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel on cancel button click", () => {
    const onCancel = vi.fn();
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("취소"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on Escape key", () => {
    const onCancel = vi.fn();
    render(<TargetSelectDialog open={true} targets={targets} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables selection and surfaces SDK hint for sdk-unresolved targets", () => {
    const unresolvedTargets: BuildTarget[] = [
      {
        id: "t-u",
        projectId: "p-1",
        name: "blocked-target",
        relativePath: "blocked/",
        buildProfile: { sdkId: "", compiler: "gcc", targetArch: "x86_64", languageStandard: "c17", headerLanguage: "auto" },
        sdkChoiceState: "sdk-unresolved",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
      ...targets,
    ];
    const onConfirm = vi.fn();
    render(<TargetSelectDialog open={true} targets={unresolvedTargets} onConfirm={onConfirm} onCancel={vi.fn()} />);

    const blocked = screen.getByRole("radio", { name: /blocked-target/ });
    expect(blocked).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/SDK 선택이 필요합니다/)).toBeInTheDocument();

    fireEvent.click(blocked);
    expect(blocked).toHaveAttribute("aria-checked", "false");

    expect(screen.getByRole("radio", { name: /gateway/ })).toHaveAttribute("aria-checked", "true");
  });
});
