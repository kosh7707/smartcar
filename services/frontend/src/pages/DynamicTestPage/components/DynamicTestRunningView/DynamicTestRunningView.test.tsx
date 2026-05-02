import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DynamicTestFinding } from "@aegis/shared";
import { DynamicTestRunningView } from "./DynamicTestRunningView";

const progress = {
  current: 12,
  total: 40,
  crashes: 1,
  anomalies: 2,
  message: "퍼징 실행 중...",
};

const findings: DynamicTestFinding[] = [
  {
    id: "finding-1",
    severity: "high",
    type: "crash",
    input: "AA BB",
    description: "Crash detected",
  },
];

describe("DynamicTestRunningView", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
  });

  it("renders progress summary and findings", () => {
    render(<DynamicTestRunningView progress={progress} findings={findings} />);

    expect(screen.getByRole("heading", { name: "동적 테스트" })).toBeInTheDocument();
    expect(screen.getByText("12 / 40")).toBeInTheDocument();
    expect(screen.getByText("퍼징 실행 중...")).toBeInTheDocument();
    expect(screen.getByText("실시간 Findings (1)")).toBeInTheDocument();
    expect(screen.getByText("Crash detected")).toBeInTheDocument();
    expect(screen.getByText("AA BB")).toBeInTheDocument();
  });

  it("shows the waiting copy before findings arrive", () => {
    render(<DynamicTestRunningView progress={progress} findings={[]} />);
    expect(screen.getByText("아직 발견된 이상 없음...")).toBeInTheDocument();
  });
});
