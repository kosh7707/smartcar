import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AnalysisGuardProvider, useAnalysisGuard, useSetAnalysisGuard } from "./AnalysisGuardContext";
import React from "react";

function TestConsumer() {
  const { isBlocking } = useAnalysisGuard();
  const { setBlocking } = useSetAnalysisGuard();
  return (
    <div>
      <span data-testid="status">{isBlocking ? "blocking" : "idle"}</span>
      <button onClick={() => setBlocking(true)}>block</button>
      <button onClick={() => setBlocking(false)}>unblock</button>
    </div>
  );
}

describe("AnalysisGuardContext", () => {
  it("defaults to not blocking", () => {
    render(<AnalysisGuardProvider><TestConsumer /></AnalysisGuardProvider>);
    expect(screen.getByTestId("status").textContent).toBe("idle");
  });

  it("setBlocking(true) sets blocking state", () => {
    render(<AnalysisGuardProvider><TestConsumer /></AnalysisGuardProvider>);
    act(() => screen.getByText("block").click());
    expect(screen.getByTestId("status").textContent).toBe("blocking");
  });

  it("setBlocking(false) clears blocking state", () => {
    render(<AnalysisGuardProvider><TestConsumer /></AnalysisGuardProvider>);
    act(() => screen.getByText("block").click());
    act(() => screen.getByText("unblock").click());
    expect(screen.getByTestId("status").textContent).toBe("idle");
  });

  it("works without provider (default values)", () => {
    function Bare() {
      const { isBlocking } = useAnalysisGuard();
      return <span>{isBlocking ? "yes" : "no"}</span>;
    }
    render(<Bare />);
    expect(screen.getByText("no")).toBeInTheDocument();
  });
});
