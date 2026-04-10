import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "./ToastContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws outside provider", () => {
    expect(() => {
      renderHook(() => useToast());
    }).toThrow("useToast must be used within ToastProvider");
  });

  it("returns error/warning/success methods", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(typeof result.current.error).toBe("function");
    expect(typeof result.current.warning).toBe("function");
    expect(typeof result.current.success).toBe("function");
  });
});

describe("ToastProvider rendering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows error toast", () => {
    function TestComponent() {
      const toast = useToast();
      return <button onClick={() => toast.error("에러!")}>show</button>;
    }

    render(<ToastProvider><TestComponent /></ToastProvider>);
    act(() => { screen.getByText("show").click(); });

    expect(screen.getByText("에러!")).toBeInTheDocument();
  });

  it("shows success toast", () => {
    function TestComponent() {
      const toast = useToast();
      return <button onClick={() => toast.success("성공!")}>show</button>;
    }

    render(<ToastProvider><TestComponent /></ToastProvider>);
    act(() => { screen.getByText("show").click(); });

    expect(screen.getByText("성공!")).toBeInTheDocument();
  });

  it("auto-dismisses after 5 seconds", () => {
    function TestComponent() {
      const toast = useToast();
      return <button onClick={() => toast.warning("경고!")}>show</button>;
    }

    render(<ToastProvider><TestComponent /></ToastProvider>);
    act(() => { screen.getByText("show").click(); });

    expect(screen.getByText("경고!")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(5100); });

    expect(screen.queryByText("경고!")).not.toBeInTheDocument();
  });

  it("keeps max 5 toasts", () => {
    function TestComponent() {
      const toast = useToast();
      return (
        <button onClick={() => {
          for (let i = 0; i < 7; i++) toast.error(`에러 ${i}`);
        }}>show</button>
      );
    }

    render(<ToastProvider><TestComponent /></ToastProvider>);
    act(() => { screen.getByText("show").click(); });

    const toasts = document.querySelectorAll(".toast");
    expect(toasts.length).toBeLessThanOrEqual(5);
  });

  it("renders toast with action button", () => {
    const actionFn = vi.fn();

    function TestComponent() {
      const toast = useToast();
      return (
        <button onClick={() => toast.error("에러", { label: "재시도", onClick: actionFn })}>
          show
        </button>
      );
    }

    render(<ToastProvider><TestComponent /></ToastProvider>);
    act(() => { screen.getByText("show").click(); });

    expect(screen.getByText("재시도")).toBeInTheDocument();
    act(() => { screen.getByText("재시도").click(); });
    expect(actionFn).toHaveBeenCalled();
  });
});
