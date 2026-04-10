import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders nothing when open=false", () => {
    render(<ConfirmDialog open={false} title="Title" message="Msg" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText("Title")).not.toBeInTheDocument();
  });

  it("renders title and message when open", () => {
    render(<ConfirmDialog open={true} title="삭제 확인" message="정말 삭제?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("삭제 확인")).toBeInTheDocument();
    expect(screen.getByText("정말 삭제?")).toBeInTheDocument();
  });

  it("uses default confirm label '확인'", () => {
    render(<ConfirmDialog open={true} title="T" message="M" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("확인")).toBeInTheDocument();
  });

  it("uses custom confirm label", () => {
    render(<ConfirmDialog open={true} title="T" message="M" confirmLabel="삭제" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("삭제")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open={true} title="T" message="M" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText("확인"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open={true} title="T" message="M" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("취소"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on overlay click", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open={true} title="T" message="M" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(document.querySelector(".confirm-overlay")!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not call onCancel when dialog body clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open={true} title="T" message="M" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(document.querySelector(".confirm-dialog")!);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel on Escape key", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open={true} title="T" message="M" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("applies danger style when danger=true", () => {
    render(<ConfirmDialog open={true} title="T" message="M" danger onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const btn = screen.getByText("확인").closest("button")!;
    expect(btn.className).toContain("confirm-dialog__btn--danger");
  });
});
