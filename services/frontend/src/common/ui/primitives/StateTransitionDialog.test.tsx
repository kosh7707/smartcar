import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StateTransitionDialog } from "./StateTransitionDialog";

const defaultProps = {
  open: true,
  currentStatus: "open" as const,
  sourceType: "rule-engine" as const,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("StateTransitionDialog", () => {
  it("renders nothing when open=false", () => {
    render(<StateTransitionDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("상태 변경")).not.toBeInTheDocument();
  });

  it("renders the current status and requires both a new status and reason before submit", () => {
    render(<StateTransitionDialog {...defaultProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("열림")).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "변경" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("사유"), { target: { value: "triage note" } });
    expect(submit).toBeDisabled();
  });

  it("closes via the cancel button and Escape key", () => {
    const onCancel = vi.fn();
    const { rerender } = render(<StateTransitionDialog {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    onCancel.mockClear();
    rerender(<StateTransitionDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
