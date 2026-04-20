import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StaticAnalysisEmptyState } from "./StaticAnalysisEmptyState";

describe("StaticAnalysisEmptyState", () => {
  it("renders the empty-state copy and checklist", () => {
    render(<StaticAnalysisEmptyState onUpload={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "정적 분석" })).toBeInTheDocument();
    expect(screen.getByText("아직 분석 데이터가 없습니다")).toBeInTheDocument();
    expect(screen.getByText("소스 업로드")).toBeInTheDocument();
    expect(screen.getByText("빌드 타겟 선택")).toBeInTheDocument();
    expect(screen.getByText("정적 분석 실행")).toBeInTheDocument();
  });

  it("calls onUpload when the CTA is clicked", () => {
    const onUpload = vi.fn();
    render(<StaticAnalysisEmptyState onUpload={onUpload} />);

    fireEvent.click(screen.getByRole("button", { name: "소스 코드 업로드" }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });
});
