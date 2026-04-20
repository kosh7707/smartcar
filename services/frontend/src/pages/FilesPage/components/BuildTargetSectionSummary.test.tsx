import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { BuildTarget } from "@aegis/shared";
import { BuildTargetSectionSummary } from "./BuildTargetSectionSummary";

const readyTargets: BuildTarget[] = [
  {
    id: "target-1",
    projectId: "project-1",
    name: "gateway",
    relativePath: "src/gateway/",
    buildProfile: {
      sdkId: "none",
      compiler: "gcc",
      targetArch: "x86_64",
      languageStandard: "c17",
      headerLanguage: "auto",
    },
    sdkChoiceState: "sdk-selected",
    status: "ready",
    createdAt: "2026-04-10T00:00:00Z",
    updatedAt: "2026-04-10T00:00:00Z",
  },
];

describe("BuildTargetSectionSummary", () => {
  it("shows pipeline progress while running", () => {
    render(
      <BuildTargetSectionSummary
        isRunning
        targets={readyTargets}
        readyTargets={[]}
        readyCount={1}
        failedCount={1}
        totalCount={3}
        canDeepAnalyzeAll={false}
        onDeepAnalyzeAll={vi.fn()}
      />,
    );

    expect(screen.getByText("파이프라인 진행 중...")).toBeInTheDocument();
    expect(screen.getByText(/1\/3 완료/)).toBeInTheDocument();
    expect(screen.getByText(/1 실패/)).toBeInTheDocument();
  });

  it("shows deep analysis CTA when ready targets exist", () => {
    const onDeepAnalyzeAll = vi.fn();
    render(
      <BuildTargetSectionSummary
        isRunning={false}
        targets={readyTargets}
        readyTargets={readyTargets}
        readyCount={1}
        failedCount={0}
        totalCount={1}
        canDeepAnalyzeAll
        onDeepAnalyzeAll={onDeepAnalyzeAll}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /전체 심층 분석/i }));
    expect(onDeepAnalyzeAll).toHaveBeenCalledWith(["target-1"]);
  });
});
