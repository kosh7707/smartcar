import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StaticAnalysisEmptyState } from "./StaticAnalysisEmptyState";

describe("StaticAnalysisEmptyState", () => {
  it("renders the empty-state eyebrow, prep steps, and preview tiles", () => {
    render(<StaticAnalysisEmptyState onUpload={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "정적 분석" })).toBeInTheDocument();
    expect(screen.getByText("STATIC ANALYSIS · AWAITING SOURCE")).toBeInTheDocument();
    expect(screen.getByText(/첫 실행까지 남은 단계/)).toBeInTheDocument();
    expect(screen.getByText("소스 업로드")).toBeInTheDocument();
    expect(screen.getByText("빌드 타겟 선택")).toBeInTheDocument();
    expect(screen.getByText("정적 분석 실행")).toBeInTheDocument();
    expect(screen.getByText("NOW")).toBeInTheDocument();
    expect(screen.getByText("ANALYSIS OUTPUT · AWAITING DATA")).toBeInTheDocument();
    expect(screen.getByText("보안 현황")).toBeInTheDocument();
    expect(screen.getByText("품질 게이트")).toBeInTheDocument();
  });

  it("calls onUpload when the CTA is clicked", () => {
    const onUpload = vi.fn();
    render(<StaticAnalysisEmptyState onUpload={onUpload} />);

    fireEvent.click(screen.getByRole("button", { name: /소스 코드 업로드/ }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });
});
