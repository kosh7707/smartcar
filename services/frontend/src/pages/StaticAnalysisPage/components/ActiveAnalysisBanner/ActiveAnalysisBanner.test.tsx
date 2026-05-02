import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActiveAnalysisBanner } from "../ActiveAnalysisBanner/ActiveAnalysisBanner";

const progress = {
  analysisId: "analysis-1",
  status: "running",
  phase: "deep_analyzing",
  message: "심층 분석 진행 중",
  currentChunk: 2,
  totalChunks: 4,
  totalFiles: 10,
  processedFiles: 3,
  buildTargetId: "target-1",
  executionId: "exec-1",
} as any;

describe("ActiveAnalysisBanner", () => {
  it("renders phase, file progress, and chunk progress", () => {
    render(<ActiveAnalysisBanner progress={progress} onView={vi.fn()} onAbort={vi.fn()} />);

    expect(screen.getByText(/3\/10개 파일/)).toBeInTheDocument();
    expect(screen.getByText(/심층 분석 진행 중/)).toBeInTheDocument();
    expect(screen.getByText(/2\/4 단계/)).toBeInTheDocument();
    expect(screen.getByText("BUILD TARGET")).toBeInTheDocument();
    expect(screen.getByText("target-1")).toBeInTheDocument();
    expect(screen.getByText("EXECUTION")).toBeInTheDocument();
    expect(screen.getByText("exec-1")).toBeInTheDocument();
  });

  it("fires view and abort actions", () => {
    const onView = vi.fn();
    const onAbort = vi.fn();
    render(<ActiveAnalysisBanner progress={progress} onView={onView} onAbort={onAbort} />);

    fireEvent.click(screen.getByRole("button", { name: "보기" }));
    fireEvent.click(screen.getByRole("button", { name: "중단" }));

    expect(onView).toHaveBeenCalledTimes(1);
    expect(onAbort).toHaveBeenCalledTimes(1);
  });
});
