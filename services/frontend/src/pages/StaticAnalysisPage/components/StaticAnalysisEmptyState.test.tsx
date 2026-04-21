import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StaticAnalysisEmptyState } from "./StaticAnalysisEmptyState";

describe("StaticAnalysisEmptyState", () => {
  it("renders the page header, awaiting-source sub caption, and prep steps", () => {
    render(<StaticAnalysisEmptyState onUpload={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "정적 분석" })).toBeInTheDocument();
    expect(screen.getByText("AWAITING SOURCE")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /준비 단계/ })).toBeInTheDocument();
    expect(screen.getByText("STEP 01 / 03")).toBeInTheDocument();
    expect(screen.getByText("소스 업로드")).toBeInTheDocument();
    expect(screen.getByText("빌드 타겟 선택")).toBeInTheDocument();
    expect(screen.getByText("정적 분석 실행")).toBeInTheDocument();
    expect(screen.getByText("NOW")).toBeInTheDocument();
  });

  it("calls onUpload when the CTA is clicked", () => {
    const onUpload = vi.fn();
    render(<StaticAnalysisEmptyState onUpload={onUpload} />);

    fireEvent.click(screen.getByRole("button", { name: /소스 코드 업로드/ }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });
});
