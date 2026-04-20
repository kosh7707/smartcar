import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GateResultCard } from "./GateResultCard";

describe("GateResultCard", () => {
  const gate = {
    status: "fail",
    evaluatedAt: "2026-04-20T01:00:00Z",
    rules: [
      { ruleId: "critical", result: "failed", message: "Critical 1건 발견" },
      { ruleId: "warning", result: "warning", message: "High 3건 발견" },
    ],
    override: {
      overriddenBy: "alice",
      reason: "Emergency release",
    },
  } as any;

  it("renders compact status badge", () => {
    render(<GateResultCard gate={{ ...gate, status: "pass", rules: [] }} compact />);

    expect(screen.getByText("통과")).toBeInTheDocument();
  });

  it("renders full gate details and override copy", () => {
    render(<GateResultCard gate={gate} />);

    expect(screen.getByText("Quality Gate: 실패")).toBeInTheDocument();
    expect(screen.getByText("Critical 1건 발견")).toBeInTheDocument();
    expect(screen.getByText("High 3건 발견")).toBeInTheDocument();
    expect(screen.getByText("Override by alice: Emergency release")).toBeInTheDocument();
  });
});
