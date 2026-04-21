import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StaticAnalysisEmptyState } from "./StaticAnalysisEmptyState";

describe("StaticAnalysisEmptyState", () => {
  it("renders the empty-state title, eyebrow, and supported formats", () => {
    render(<StaticAnalysisEmptyState onUpload={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "정적 분석" })).toBeInTheDocument();
    expect(screen.getByText("AWAITING INPUT")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "분석 대기" })).toBeInTheDocument();
    expect(screen.getByText(/소스 아카이브 업로드/)).toBeInTheDocument();
    expect(screen.getByText(".zip")).toBeInTheDocument();
    expect(screen.getByText(".tar.gz")).toBeInTheDocument();
  });

  it("calls onUpload when the CTA is clicked", () => {
    const onUpload = vi.fn();
    render(<StaticAnalysisEmptyState onUpload={onUpload} />);

    fireEvent.click(screen.getByRole("button", { name: /소스 코드 업로드/ }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });
});
