import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AsyncAnalysisProgressView } from "../AsyncAnalysisProgressView/AsyncAnalysisProgressView";

const baseProgress = {
  analysisId: "analysis-1",
  status: "running",
  phase: "llm_chunk",
  currentChunk: 2,
  totalChunks: 4,
  totalFiles: 10,
  processedFiles: 3,
  message: "AI 분석 진행 중",
  startedAt: "2026-04-14T00:00:00Z",
} as any;

describe("AsyncAnalysisProgressView", () => {
  it("renders phase, chunk progress, and action buttons while running", () => {
    const onAbort = vi.fn();
    render(
      <AsyncAnalysisProgressView
        progress={baseProgress}
        onAbort={onAbort}
        onViewResult={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "정적 분석" })).toBeInTheDocument();
    expect(screen.getByText("분석 진행 중...")).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 10개 파일 진행 중/)).toBeInTheDocument();
    expect(screen.getByText(/LLM 분석 2 \/ 4 단계/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "분석 중단" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders completed state and manual result action", () => {
    render(
      <AsyncAnalysisProgressView
        progress={{ ...baseProgress, status: "completed", phase: "complete", totalChunks: 4, currentChunk: 4 }}
        onAbort={vi.fn()}
        onViewResult={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("분석 완료")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /결과 보기/ })).toBeInTheDocument();
  });
});
