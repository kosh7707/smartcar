import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisProgressView } from "../AnalysisProgressView/AnalysisProgressView";

describe("AnalysisProgressView", () => {
  it("renders progress percentage and current step", () => {
    render(<AnalysisProgressView progress={42} step="룰 분석 진행 중" />);

    expect(screen.getByRole("heading", { name: "정적 분석" })).toBeInTheDocument();
    expect(screen.getByText("분석 진행 중...")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("룰 분석 진행 중")).toBeInTheDocument();
  });

  it("shows all three progress steps", () => {
    render(<AnalysisProgressView progress={80} step="결과 처리 중" />);
    expect(screen.getByText("파일 업로드")).toBeInTheDocument();
    expect(screen.getByText("분석 실행")).toBeInTheDocument();
    expect(screen.getByText("결과 처리")).toBeInTheDocument();
  });
});
