import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TwoStageProgressView } from "./TwoStageProgressView";

describe("TwoStageProgressView", () => {
  it("renders the shared plain header for active analysis progress", () => {
    render(
      <TwoStageProgressView
        analysisId="analysis-1"
        stage="deep_analyzing"
        message="심층 분석을 진행하고 있습니다."
        quickFindingCount={2}
        deepFindingCount={null}
        error={null}
        errorPhase={null}
        retryable={false}
        targetName={null}
        targetProgress={null}
        onRetry={vi.fn()}
        onViewResults={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "분석 진행 중..." })).toBeInTheDocument();
    expect(document.querySelector(".page-header__subtitle")).toHaveTextContent("심층 분석을 진행하고 있습니다.");
  });

  it("renders the completion header variant for finished analysis", () => {
    render(
      <TwoStageProgressView
        analysisId="analysis-1"
        stage="deep_complete"
        message=""
        quickFindingCount={2}
        deepFindingCount={3}
        error={null}
        errorPhase={null}
        retryable={false}
        targetName={null}
        targetProgress={null}
        onRetry={vi.fn()}
        onViewResults={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "분석 완료" })).toBeInTheDocument();
  });
});
