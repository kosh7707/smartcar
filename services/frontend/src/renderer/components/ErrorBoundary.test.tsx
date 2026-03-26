import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";
import React from "react";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error");
  return <span>OK</span>;
}

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary><span>Hello</span></ErrorBoundary>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders fallback UI on error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary><ThrowingChild shouldThrow={true} /></ErrorBoundary>,
    );
    expect(screen.getByText("페이지를 표시할 수 없습니다")).toBeInTheDocument();
    expect(screen.getByText(/예기치 않은 오류/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("recovers on reload button click", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Use a wrapper that can control throwing
    let shouldThrow = true;
    function Controlled() {
      if (shouldThrow) throw new Error("err");
      return <span>Recovered</span>;
    }
    const { rerender } = render(
      <ErrorBoundary><Controlled /></ErrorBoundary>,
    );
    expect(screen.getByText("페이지를 표시할 수 없습니다")).toBeInTheDocument();

    // Stop throwing and click reload
    shouldThrow = false;
    fireEvent.click(screen.getByText("새로고침"));
    rerender(<ErrorBoundary><Controlled /></ErrorBoundary>);
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
